package main

import (
	"crypto/sha1"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	lnctlkit "github.com/jabberwocky238/luna-edge/lnctl"
	"github.com/jabberwocky238/luna-edge/repository/metadata"
	"github.com/miekg/dns"
)

//go:embed web/dist
var webDist embed.FS

type server struct {
	client lnctlkit.ClientInterface
}

type errorResponse struct {
	Error string `json:"error"`
}

type queryDomainRequest struct {
	Hostname string `json:"hostname"`
}

type queryDNSRequest struct {
	Hostname string `json:"hostname"`
}

type planRouteInput struct {
	Path             string `json:"path"`
	ExternalEndpoint string `json:"externalEndpoint"`
	ServicePort      uint32 `json:"servicePort"`
}

type planRequest struct {
	Hostname         string           `json:"hostname"`
	BackendType      string           `json:"backendType"`
	BackendRefType   string           `json:"backendRefType"`
	ServiceNamespace string           `json:"serviceNamespace"`
	ServiceName      string           `json:"serviceName"`
	ExternalEndpoint string           `json:"externalEndpoint"`
	ServicePort      uint32           `json:"servicePort"`
	Routes           []planRouteInput `json:"routes"`
}

type dnsRecordInput struct {
	ExistingRecordID string   `json:"existingRecordId"`
	FQDN             string   `json:"fqdn"`
	RecordType       string   `json:"recordType"`
	RoutingClass     string   `json:"routingClass"`
	TTLSeconds       uint32   `json:"ttlSeconds"`
	RoutingKey       string   `json:"routingKey"`
	Enabled          bool     `json:"enabled"`
	Values           []string `json:"values"`
}

type dnsApplyRequest struct {
	Hostname string           `json:"hostname"`
	Records  []dnsRecordInput `json:"records"`
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}

func main() {
	addr := envOrDefault("LUNA_EDGE_PANEL_ADDR", "127.0.0.1:18090")
	mux := http.NewServeMux()
	// client := lnctlkit.NewClient(envOrDefault("LUNA_EDGE_PANEL_MASTER_URL", "http://127.0.0.1:8080"))
	client := lnctlkit.NewMockClient("sqlite://?mode=memory")
	server := &server{client: client}
	mux.HandleFunc("/api/query/domain", server.handleQueryDomain)
	mux.HandleFunc("/api/query/dns", server.handleQueryDNS)
	mux.HandleFunc("/api/dns/apply", server.handleApplyDNS)
	mux.HandleFunc("/api/plan/preview", server.handlePreviewPlan)
	mux.HandleFunc("/api/plan/apply", server.handleApplyPlan)
	mux.Handle("/", staticHandler())

	log.Printf("listening on http://%s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func (s *server) handleQueryDomain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req queryDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	projection, err := s.client.QueryDomainEntryProjection(req.Hostname)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, projection)
}

func (s *server) handleQueryDNS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req queryDNSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	records, err := s.queryAllDNSRecords(req.Hostname)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, records)
}

func (s *server) handleApplyDNS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req dnsApplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	plan, err := s.buildDNSPlan(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	applied, err := s.client.ApplyPlan(plan)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, applied)
}

func (s *server) handlePreviewPlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	plan, err := s.buildPlanFromRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

func (s *server) handleApplyPlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	_, plan, err := s.decodeAndBuildPlan(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	applied, err := s.client.ApplyPlan(plan)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, applied)
}

func staticHandler() http.Handler {
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

func (s *server) decodeAndBuildPlan(r *http.Request) (*planRequest, *lnctlkit.Plan, error) {
	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, nil, errors.New("invalid json body")
	}
	plan, err := s.buildPlan(req)
	if err != nil {
		return nil, nil, err
	}
	return &req, plan, nil
}

func (s *server) buildPlanFromRequest(r *http.Request) (*lnctlkit.Plan, error) {
	_, plan, err := s.decodeAndBuildPlan(r)
	return plan, err
}

func (s *server) buildPlan(req planRequest) (*lnctlkit.Plan, error) {
	if err := s.validateEndpointDNSReady(strings.TrimSpace(req.Hostname)); err != nil {
		return nil, err
	}

	existingProjection, _ := s.client.QueryDomainEntryProjection(req.Hostname)

	builder := lnctlkit.NewBuilder(req.Hostname).
		WithExistingProjection(existingProjection)

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

	for _, route := range req.Routes {
		path := strings.TrimSpace(route.Path)
		if path == "" {
			continue
		}

		endpoint := strings.TrimSpace(route.ExternalEndpoint)
		if endpoint == "" {
			endpoint = strings.TrimSpace(req.ExternalEndpoint)
		}

		port := route.ServicePort
		if port == 0 {
			port = req.ServicePort
		}

		builder.Route(path, lnctlkit.BackendTarget{
			Type:              metadata.ServiceBackendType(req.BackendRefType),
			ArbitraryEndpoint: endpoint,
			ServiceNamespace:  strings.TrimSpace(req.ServiceNamespace),
			ServiceName:       strings.TrimSpace(req.ServiceName),
			Port:              port,
		})
	}

	return builder.Build()
}

func (s *server) validateEndpointDNSReady(hostname string) error {
	if hostname == "" {
		return errors.New("hostname is required")
	}

	values, err := queryPublicCNAMEs(hostname)
	if err != nil {
		return fmt.Errorf("query public cname for %q: %w", hostname, err)
	}
	for _, value := range values {
		if normalizeDNSValue(value) == normalizeDNSValue("ns1.app238.com") {
			return nil
		}
	}

	return fmt.Errorf("hostname %q must have a public CNAME to ns1.app238.com before creating endpoint plan", hostname)
}

func (s *server) queryAllDNSRecords(hostname string) ([]metadata.DNSRecord, error) {
	recordTypes := []string{
		string(metadata.DNSTypeA),
		string(metadata.DNSTypeAAAA),
		string(metadata.DNSTypeCNAME),
		string(metadata.DNSTypeTXT),
		string(metadata.DNSTypeMX),
		string(metadata.DNSTypeNS),
		string(metadata.DNSTypeSRV),
		string(metadata.DNSTypeCAA),
	}
	records := make([]metadata.DNSRecord, 0)
	seen := make(map[string]struct{})
	for _, recordType := range recordTypes {
		items, err := s.client.QueryDNSRecords(strings.TrimSpace(hostname), recordType)
		if err != nil {
			continue
		}
		for _, item := range items {
			key := item.ID
			if key == "" {
				key = item.FQDN + ":" + string(item.RecordType) + ":" + item.RoutingKey + ":" + item.ValuesJSON
			}
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			records = append(records, item)
		}
	}
	return records, nil
}

func (s *server) buildDNSPlan(req dnsApplyRequest) (*lnctlkit.Plan, error) {
	hostname := strings.TrimSpace(req.Hostname)
	if hostname == "" {
		return nil, errors.New("hostname is required")
	}
	existing, err := s.queryAllDNSRecords(hostname)
	if err != nil {
		return nil, err
	}
	existingByID := make(map[string]metadata.DNSRecord, len(existing))
	for _, item := range existing {
		existingByID[item.ID] = item
	}

	plan := &lnctlkit.Plan{Hostname: hostname}
	desiredIDs := make(map[string]struct{})
	for _, item := range req.Records {
		record := metadata.DNSRecord{
			ID:           strings.TrimSpace(item.ExistingRecordID),
			FQDN:         strings.TrimSpace(item.FQDN),
			RecordType:   metadata.DNSRecordType(strings.TrimSpace(item.RecordType)),
			RoutingClass: metadata.RoutingClass(strings.TrimSpace(item.RoutingClass)),
			TTLSeconds:   item.TTLSeconds,
			RoutingKey:   strings.TrimSpace(item.RoutingKey),
			Enabled:      item.Enabled,
		}
		if record.FQDN == "" {
			continue
		}
		if record.RecordType == "" {
			record.RecordType = metadata.DNSTypeA
		}
		if record.RoutingClass == "" {
			record.RoutingClass = metadata.RoutingClassFirst
		}
		if record.TTLSeconds == 0 {
			record.TTLSeconds = 60
		}
		valuesJSON, err := json.Marshal(item.Values)
		if err != nil {
			return nil, fmt.Errorf("marshal dns values: %w", err)
		}
		record.ValuesJSON = string(valuesJSON)
		if record.ID == "" {
			record.ID = defaultPanelDNSRecordID(record)
		}
		if current, ok := existingByID[record.ID]; ok && record.ID != "" {
			desiredIDs[record.ID] = struct{}{}
			currentCopy := current
			desiredCopy := record
			plan.DNSRecords = append(plan.DNSRecords, lnctlkit.DNSRecordChange{
				Action:  lnctlkit.PlanActionUpdate,
				Current: &currentCopy,
				Desired: &desiredCopy,
			})
			continue
		}
		desiredCopy := record
		plan.DNSRecords = append(plan.DNSRecords, lnctlkit.DNSRecordChange{
			Action:  lnctlkit.PlanActionCreate,
			Desired: &desiredCopy,
		})
	}

	for _, current := range existing {
		if _, ok := desiredIDs[current.ID]; ok {
			continue
		}
		if current.FQDN != hostname {
			continue
		}
		currentCopy := current
		plan.DNSRecords = append(plan.DNSRecords, lnctlkit.DNSRecordChange{
			Action:  lnctlkit.PlanActionDelete,
			Current: &currentCopy,
		})
	}
	return plan, nil
}

func defaultPanelDNSRecordID(record metadata.DNSRecord) string {
	payload := strings.Join([]string{
		normalizeDNSValue(record.FQDN),
		string(record.RecordType),
		string(record.RoutingClass),
		strings.TrimSpace(record.RoutingKey),
		strconv.FormatUint(uint64(record.TTLSeconds), 10),
		strings.TrimSpace(record.ValuesJSON),
		strconv.FormatBool(record.Enabled),
	}, "|")
	sum := sha1.Sum([]byte(payload))
	return fmt.Sprintf("panel-dns-%x", sum[:8])
}

func queryPublicCNAMEs(hostname string) ([]string, error) {
	name := dns.Fqdn(strings.TrimSpace(hostname))
	if name == "." {
		return nil, errors.New("hostname is required")
	}
	resolvers := []string{"1.1.1.1:53", "8.8.8.8:53"}
	var lastErr error
	for _, resolver := range resolvers {
		msg := &dns.Msg{}
		msg.SetQuestion(name, dns.TypeCNAME)
		client := &dns.Client{}
		resp, _, err := client.Exchange(msg, resolver)
		if err != nil {
			lastErr = err
			continue
		}
		values := make([]string, 0)
		for _, answer := range resp.Answer {
			record, ok := answer.(*dns.CNAME)
			if ok {
				values = append(values, record.Target)
			}
		}
		if len(values) > 0 {
			return values, nil
		}
		lastErr = fmt.Errorf("no cname answer from %s", resolver)
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("no public resolver available")
}

func normalizeDNSValue(value string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(value)), ".")
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
