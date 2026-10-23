package studio

import "testing"

func TestParseBibtexLatex(t *testing.T) {
	got := parseBibtex(`@inproceedings{he2017,
  title={Mask {R-CNN} -- revisited \& extended},
  author={He, Kaiming and Doll{\'a}r, Piotr and M\"{u}ller, J{\"o}rg and Fran\c{c}ois, A.},
  year={2017}
}`)
	if len(got) != 1 {
		t.Fatalf("entries = %d", len(got))
	}
	if want := "Mask R-CNN – revisited & extended"; got[0]["title"] != want {
		t.Errorf("title = %q, want %q", got[0]["title"], want)
	}
	if want := "He, Kaiming and Dollár, Piotr and Müller, Jörg and François, A."; got[0]["author"] != want {
		t.Errorf("author = %q, want %q", got[0]["author"], want)
	}
}
