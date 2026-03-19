package main

import (
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	lnctlkit "github.com/jabberwocky238/luna-edge/lnctl"
	"github.com/jabberwocky238/luna-edge/repository/metadata"
)

//go:embed web/dist
var webDist embed.FS

type app struct{}

type errorResponse struct {
	Error string `json:"error"`
}

type queryDomainRequest struct {
	MasterURL string `json:"masterUrl"`
	Hostname  string `json:"hostname"`
}

type queryDNSRequest struct {
	MasterURL  string `json:"masterUrl"`
	Hostname   string `json:"hostname"`
	RecordType string `json:"recordType"`
}

type planRouteInput struct {
	Path string `json:"path"`
}

type planRequest struct {
	MasterURL        string           `json:"masterUrl"`
	Hostname         string           `json:"hostname"`
	BackendType      string           `json:"backendType"`
	BackendRefType   string           `json:"backendRefType"`
	ServiceNamespace string           `json:"serviceNamespace"`
	ServiceName      string           `json:"serviceName"`
	ExternalEndpoint string           `json:"externalEndpoint"`
	ServicePort      uint32           `json:"servicePort"`
	EnableDNS        bool             `json:"enableDns"`
	DNSRecordType    string           `json:"dnsRecordType"`
	DNSRoutingClass  string           `json:"dnsRoutingClass"`
	DNSTTLSeconds    uint32           `json:"dnsTtlSeconds"`
	DNSValuesJSON    string           `json:"dnsValuesJson"`
	DNSRoutingKey    string           `json:"dnsRoutingKey"`
	Routes           []planRouteInput `json:"routes"`
}

func main() {
	addr := envOrDefault("LUNA_EDGE_PANEL_ADDR", "127.0.0.1:8090")

	mux := http.NewServeMux()
	server := &app{}
	mux.HandleFunc("/api/query/domain", server.handleQueryDomain)
	mux.HandleFunc("/api/query/dns", server.handleQueryDNS)
	mux.HandleFunc("/api/plan/preview", server.handlePreviewPlan)
	mux.HandleFunc("/api/plan/apply", server.handleApplyPlan)
	mux.Handle("/", server.staticHandler())

	log.Printf("listening on http://%s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func (a *app) handleQueryDomain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req queryDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	client, err := newClient(req.MasterURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	projection, err := client.QueryDomainEntryProjection(req.Hostname)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, projection)
}

func (a *app) handleQueryDNS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req queryDNSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	client, err := newClient(req.MasterURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	records, err := client.QueryDNSRecords(req.Hostname, req.RecordType)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, records)
}

func (a *app) handlePreviewPlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	plan, err := buildPlanFromRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

func (a *app) handleApplyPlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	req, plan, err := decodeAndBuildPlan(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	client, err := newClient(req.MasterURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	applied, err := client.ApplyPlan(plan)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, applied)
}

func (a *app) staticHandler() http.Handler {
	sub, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			writeError(w, http.StatusInternalServerError, "frontend assets unavailable")
		})
	}
	files := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			http.ServeFileFS(w, r, sub, "index.html")
			return
		}
		if _, err := fs.Stat(sub, strings.TrimPrefix(r.URL.Path, "/")); err == nil {
			files.ServeHTTP(w, r)
			return
		}
		http.ServeFileFS(w, r, sub, "index.html")
	})
}

func decodeAndBuildPlan(r *http.Request) (*planRequest, *lnctlkit.Plan, error) {
	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, nil, errors.New("invalid json body")
	}
	plan, err := buildPlan(req)
	if err != nil {
		return nil, nil, err
	}
	return &req, plan, nil
}

func buildPlanFromRequest(r *http.Request) (*lnctlkit.Plan, error) {
	_, plan, err := decodeAndBuildPlan(r)
	return plan, err
}

func buildPlan(req planRequest) (*lnctlkit.Plan, error) {
	client, err := newClient(req.MasterURL)
	if err != nil {
		return nil, err
	}

	existingProjection, _ := client.QueryDomainEntryProjection(req.Hostname)
	existingDNSRecords, _ := client.QueryDNSRecords(req.Hostname, req.DNSRecordType)

	builder := lnctlkit.NewBuilder(req.Hostname).
		WithExistingProjection(existingProjection).
		WithExistingDNSRecords(existingDNSRecords...)

	switch req.BackendType {
	case string(metadata.BackendTypeL7HTTP):
		builder.AsL7HTTP()
	case string(metadata.BackendTypeL7HTTPS):
		builder.AsL7HTTPS()
	case string(metadata.BackendTypeL7HTTPBoth):
		builder.AsL7HTTPBoth()
	default:
		return nil, errors.New("only l7-http, l7-https, l7-http-both are supported")
	}

	backend := lnctlkit.BackendTarget{
		Type:              metadata.ServiceBackendType(req.BackendRefType),
		ArbitraryEndpoint: strings.TrimSpace(req.ExternalEndpoint),
		ServiceNamespace:  strings.TrimSpace(req.ServiceNamespace),
		ServiceName:       strings.TrimSpace(req.ServiceName),
		Port:              req.ServicePort,
	}

	for _, route := range req.Routes {
		if strings.TrimSpace(route.Path) == "" {
			continue
		}
		builder.Route(route.Path, backend)
	}

	if req.EnableDNS {
		builder.WantDNS(metadata.DNSRecord{
			FQDN:         strings.TrimSpace(req.Hostname),
			RecordType:   metadata.DNSRecordType(strings.TrimSpace(req.DNSRecordType)),
			RoutingClass: metadata.RoutingClass(strings.TrimSpace(req.DNSRoutingClass)),
			TTLSeconds:   req.DNSTTLSeconds,
			ValuesJSON:   strings.TrimSpace(req.DNSValuesJSON),
			RoutingKey:   strings.TrimSpace(req.DNSRoutingKey),
			Enabled:      true,
		})
	}

	return builder.Build()
}

func newClient(masterURL string) (*lnctlkit.Client, error) {
	masterURL = strings.TrimSpace(masterURL)
	if masterURL == "" {
		return nil, errors.New("masterUrl is required")
	}
	return lnctlkit.NewClient(masterURL), nil
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}
