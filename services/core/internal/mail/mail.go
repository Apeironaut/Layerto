// Package mail sends transactional email (password resets).
package mail

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// Message is a plain-text email.
type Message struct {
	To      string
	Subject string
	Body    string
}

// Mailer sends a message. Implementations must not log message bodies in production.
type Mailer interface {
	Send(ctx context.Context, m Message) error
}

// FromEnv picks the mailer from environment variables:
//   - SMTP_HOST set          → SMTP (SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM; SMTP_TLS=implicit for port 465)
//   - MAIL_DEV_LOG=1          → prints messages to the server log (local development only)
//   - otherwise               → drops messages and logs that email is not configured
func FromEnv() Mailer {
	if host := os.Getenv("SMTP_HOST"); host != "" {
		port := os.Getenv("SMTP_PORT")
		if port == "" {
			port = "587"
		}
		return &SMTPMailer{
			Host:     host,
			Port:     port,
			User:     os.Getenv("SMTP_USER"),
			Pass:     os.Getenv("SMTP_PASS"),
			From:     os.Getenv("MAIL_FROM"),
			Implicit: os.Getenv("SMTP_TLS") == "implicit",
		}
	}
	if os.Getenv("MAIL_DEV_LOG") == "1" {
		return DevLogMailer{}
	}
	return DisabledMailer{}
}

// DevLogMailer prints the message to the log. Never enable it in production:
// reset links in logs are as good as passwords.
type DevLogMailer struct{}

func (DevLogMailer) Send(_ context.Context, m Message) error {
	log.Printf("[mail:dev] to=%s subject=%q\n%s", m.To, m.Subject, m.Body)
	return nil
}

// DisabledMailer drops messages.
type DisabledMailer struct{}

func (DisabledMailer) Send(_ context.Context, _ Message) error {
	log.Printf("[mail] email is not configured (set SMTP_HOST, or MAIL_DEV_LOG=1 for local development); message dropped")
	return nil
}

// SMTPMailer sends through an SMTP server with STARTTLS (or implicit TLS).
type SMTPMailer struct {
	Host, Port, User, Pass, From string
	Implicit                     bool
}

var ErrHeaderInjection = errors.New("invalid characters in email header")

func (s *SMTPMailer) Send(ctx context.Context, m Message) error {
	for _, v := range []string{m.To, m.Subject, s.From} {
		if strings.ContainsAny(v, "\r\n") {
			return ErrHeaderInjection
		}
	}
	msg := buildMessage(s.From, m)
	addr := net.JoinHostPort(s.Host, s.Port)
	var auth smtp.Auth
	if s.User != "" {
		auth = smtp.PlainAuth("", s.User, s.Pass, s.Host)
	}

	done := make(chan error, 1)
	go func() {
		if s.Implicit {
			done <- s.sendImplicitTLS(addr, auth, m.To, msg)
			return
		}
		done <- smtp.SendMail(addr, auth, s.From, []string{m.To}, msg)
	}()
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(20 * time.Second):
		return errors.New("smtp send timed out")
	}
}

func (s *SMTPMailer) sendImplicitTLS(addr string, auth smtp.Auth, to string, msg []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12})
	if err != nil {
		return err
	}
	c, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		return err
	}
	defer c.Close()
	if auth != nil {
		if err := c.Auth(auth); err != nil {
			return err
		}
	}
	if err := c.Mail(s.From); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

func buildMessage(from string, m Message) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", m.To)
	fmt.Fprintf(&b, "Subject: %s\r\n", m.Subject)
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	b.WriteString(strings.ReplaceAll(m.Body, "\n", "\r\n"))
	return []byte(b.String())
}
