import { Button, Icon } from '@layerto/ui';

export interface SampleImagePickerProps {
  onSelectSample: (file: File) => void;
  disabled?: boolean;
}

/**
 * Creates sample image files directly in the browser so users can test models instantly.
 */
function createSyntheticSampleImage(type: 'turtle' | 'bio'): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;

    if (type === 'turtle') {
      // Ocean gradient background
      const ocean = ctx.createLinearGradient(0, 0, 640, 480);
      ocean.addColorStop(0, '#0c4a6e');
      ocean.addColorStop(0.5, '#0369a1');
      ocean.addColorStop(1, '#0284c7');
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, 640, 480);

      // Sun rays
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(200, 0);
      ctx.lineTo(260, 0);
      ctx.lineTo(440, 480);
      ctx.lineTo(360, 480);
      ctx.fill();

      // Turtle body (Carapace)
      ctx.fillStyle = '#1e3a1e';
      ctx.beginPath();
      ctx.ellipse(320, 240, 140, 100, 0, 0, Math.PI * 2);
      ctx.fill();

      // Carapace scute texture
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Scute segments
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        ctx.strokeRect(260 + i * 24, 210, 20, 50);
      }

      // Head & flippers
      ctx.fillStyle = '#2d5a27';
      // Head
      ctx.beginPath();
      ctx.ellipse(480, 240, 35, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // Flippers
      ctx.beginPath();
      ctx.ellipse(380, 130, 70, 25, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(380, 350, 70, 25, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Label text on specimen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Chelonia mydas · Marine Specimen #042', 20, 30);
    } else {
      // Coral reef background
      const bg = ctx.createLinearGradient(0, 0, 640, 480);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 640, 480);

      // Biological organism representation
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(320, 240, 90, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Internal structures
      ctx.fillStyle = '#fbbf24';
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const x = 320 + Math.cos(angle) * 55;
        const y = 240 + Math.sin(angle) * 55;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Caretta caretta · BioCLIP Taxonomy Test', 20, 30);
    }

    canvas.toBlob((blob) => {
      const file = new File(
        [blob!],
        type === 'turtle' ? 'sample_sea_turtle.jpg' : 'sample_bio_specimen.jpg',
        { type: 'image/jpeg' },
      );
      resolve(file);
    }, 'image/jpeg', 0.95);
  });
}

export function SampleImagePicker({ onSelectSample, disabled }: SampleImagePickerProps) {
  const load = async (type: 'turtle' | 'bio') => {
    const file = await createSyntheticSampleImage(type);
    onSelectSample(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <span className="text-xs text-muted flex items-center gap-1 font-medium">
        <Icon name="spark" className="w-3.5 h-3.5 text-crimson" />
        Quick test images:
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => load('turtle')}
        disabled={disabled}
      >
        Sea Turtle Sample
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => load('bio')}
        disabled={disabled}
      >
        Bio Specimen Sample
      </Button>
    </div>
  );
}
