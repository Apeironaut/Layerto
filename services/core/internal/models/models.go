package models

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

var (
	ErrModelTimeout  = errors.New("model worker timed out")
	ErrModelResponse = errors.New("invalid model worker response")
	ErrModelFailed   = errors.New("model worker returned error")
)

// Prediction matches SPEC §8 and SPEC §10.
type Prediction struct {
	Label      string         `json:"label"`
	Confidence float64        `json:"confidence"`
	BBox       *[4]int        `json:"bbox"`
	Extra      map[string]any `json:"extra,omitempty"`
}

// WorkerResponse represents the standardized worker output per SPEC §10.
type WorkerResponse struct {
	Predictions  []Prediction `json:"predictions"`
	ModelVersion string       `json:"model_version"`
}

type runpodRequest struct {
	Input struct {
		ImageBase64 string         `json:"image_base64"`
		Prompt      string         `json:"prompt,omitempty"`
		Params      map[string]any `json:"params,omitempty"`
	} `json:"input"`
}

// Client defines the interface for executing vision models.
type Client interface {
	RunSync(ctx context.Context, endpoint string, modelSlug string, imageBase64 string, prompt string, params map[string]any) (*WorkerResponse, error)
}

type runpodClient struct {
	apiKey     string
	httpClient *http.Client
	fakeMode   bool
}

// NewClient returns a RunPod client or a mock client if MODEL_FAKE=1.
func NewClient(apiKey string) Client {
	fake := os.Getenv("MODEL_FAKE") == "1"
	return &runpodClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		fakeMode: fake,
	}
}

func (c *runpodClient) RunSync(ctx context.Context, endpoint, modelSlug, imageBase64, prompt string, params map[string]any) (*WorkerResponse, error) {
	if c.fakeMode {
		return c.mockResponse(modelSlug)
	}

	url := fmt.Sprintf("https://api.runpod.ai/v2/%s/runsync", endpoint)

	var reqBody runpodRequest
	reqBody.Input.ImageBase64 = imageBase64
	reqBody.Input.Prompt = prompt
	reqBody.Input.Params = params

	b, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal runpod request error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("create runpod request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ErrModelTimeout
		}
		return nil, fmt.Errorf("runpod request error: %w", err)
	}
	defer resp.Body.Close()

	// Max 2 MB response size cap per DESIGN T12
	lr := io.LimitReader(resp.Body, 2<<20)
	respBytes, err := io.ReadAll(lr)
	if err != nil {
		return nil, fmt.Errorf("read runpod response error: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d", ErrModelFailed, resp.StatusCode)
	}

	var output struct {
		Status string          `json:"status"`
		Output *WorkerResponse `json:"output"`
		Error  *string         `json:"error"`
	}

	if err := json.Unmarshal(respBytes, &output); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrModelResponse, err)
	}

	if output.Error != nil && *output.Error != "" {
		return nil, fmt.Errorf("%w: %s", ErrModelFailed, *output.Error)
	}

	if output.Output == nil || len(output.Output.Predictions) == 0 {
		return nil, fmt.Errorf("%w: missing predictions", ErrModelResponse)
	}

	return output.Output, nil
}

func (c *runpodClient) mockResponse(modelSlug string) (*WorkerResponse, error) {
	// Requirement 6: MODEL_FAKE_FAIL only works when MODEL_FAKE=1. Ignore it otherwise.
	if os.Getenv("MODEL_FAKE") == "1" && os.Getenv("MODEL_FAKE_FAIL") == "1" {
		return nil, errors.New("simulated model worker failure (MODEL_FAKE_FAIL=1)")
	}

	if modelSlug == "turtle-id" {
		bbox := [4]int{100, 80, 250, 180} // valid [x, y, w, h] per SPEC §8/§10
		return &WorkerResponse{
			ModelVersion: "2026.10.1",
			Predictions: []Prediction{
				{
					Label:      "Chelonia mydas",
					Confidence: 0.98,
					BBox:       &bbox,
					Extra: map[string]any{
						"individual_id": "turtle-042",
					},
				},
			},
		}, nil
	}

	if modelSlug == "bioclip" {
		return &WorkerResponse{
			ModelVersion: "2026.10.1",
			Predictions: []Prediction{
				{
					Label:      "Caretta caretta",
					Confidence: 0.95,
					BBox:       nil,
					Extra:      map[string]any{},
				},
			},
		}, nil
	}

	return &WorkerResponse{
		ModelVersion: "2026.10.1",
		Predictions: []Prediction{
			{
				Label:      "Test specimen",
				Confidence: 0.90,
				BBox:       nil,
				Extra:      map[string]any{},
			},
		},
	}, nil
}
