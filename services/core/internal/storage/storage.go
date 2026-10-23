// Package storage keeps user files (dataset images, model weights) on disk, encrypted with
// AES-256-GCM. Inference images never come here: only datasets a user uploads for training.
package storage

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

var ErrNotFound = errors.New("file not found")

type Store struct {
	root string
	aead cipher.AEAD
}

// FromEnv uses STORAGE_DIR (default ./data) and DATA_KEY (64 hex chars). Without DATA_KEY a
// fixed development key is used and a warning is logged - never run production like that.
func FromEnv() (*Store, error) {
	root := os.Getenv("STORAGE_DIR")
	if root == "" {
		root = "./data"
	}
	var key []byte
	if k := os.Getenv("DATA_KEY"); k != "" {
		b, err := hex.DecodeString(k)
		if err != nil || len(b) != 32 {
			return nil, fmt.Errorf("DATA_KEY must be 64 hex characters (32 bytes)")
		}
		key = b
	} else {
		log.Printf("warning: DATA_KEY not set, using the development encryption key (set DATA_KEY in production)")
		sum := sha256.Sum256([]byte("layerto-dev-data-key"))
		key = sum[:]
	}
	return New(root, key)
}

func New(root string, key []byte) (*Store, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	return &Store{root: root, aead: aead}, nil
}

func (s *Store) path(key string) (string, error) {
	if key == "" || strings.Contains(key, "..") || strings.HasPrefix(key, "/") {
		return "", fmt.Errorf("invalid storage key")
	}
	return filepath.Join(s.root, filepath.FromSlash(key)), nil
}

// Put encrypts and writes data under key (atomic rename).
func (s *Store) Put(key string, data []byte) error {
	p, err := s.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}
	sealed := s.aead.Seal(nonce, nonce, data, []byte(key))
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, sealed, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// Get reads and decrypts the file under key.
func (s *Store) Get(key string) ([]byte, error) {
	p, err := s.path(key)
	if err != nil {
		return nil, err
	}
	sealed, err := os.ReadFile(p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	n := s.aead.NonceSize()
	if len(sealed) < n {
		return nil, fmt.Errorf("corrupt file")
	}
	return s.aead.Open(nil, sealed[:n], sealed[n:], []byte(key))
}

// Delete removes one file (missing files are fine).
func (s *Store) Delete(key string) error {
	p, err := s.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// DeletePrefix removes a whole folder, e.g. "datasets/<id>".
func (s *Store) DeletePrefix(prefix string) error {
	p, err := s.path(prefix)
	if err != nil {
		return err
	}
	return os.RemoveAll(p)
}

// PutPlain / GetPlainPath store files that are not user data (the LTVision code package).
func (s *Store) PutPlain(key string, data []byte) error {
	p, err := s.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o600)
}

func (s *Store) PlainPath(key string) (string, error) {
	p, err := s.path(key)
	if err != nil {
		return "", err
	}
	if _, err := os.Stat(p); err != nil {
		return "", ErrNotFound
	}
	return p, nil
}
