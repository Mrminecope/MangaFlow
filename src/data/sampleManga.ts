/**
 * Generates an engaging 5-page sample manga ("Cyber Ronin: Flow of the Void")
 * using HTML5 Canvas rendering. This allows immediate testing of eye tracking,
 * smooth scrolling, and auto-scroll features out of the box.
 */
export async function createSampleMangaPages(): Promise<Array<{ name: string; blob: Blob; aspectRatio: number }>> {
  const pages: Array<{ name: string; blob: Blob; aspectRatio: number }> = [];

  const width = 900;
  const height = 1350; // 0.667 aspect ratio (standard manga tankobon format)

  const titles = [
    'Act 1: Awakening in the Neo-District',
    'Act 2: The Stalker in the Rain',
    'Act 3: Blade of Resonating Data',
    'Act 4: The Void Gate Unsealed',
    'Act 5: Gaze of the Flow Master',
  ];

  for (let i = 0; i < titles.length; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // Manga border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Page header
    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MANGAFLOW • CHAPTER 1', 50, 65);
    ctx.textAlign = 'right';
    ctx.fillText(`PAGE ${i + 1} OF ${titles.length}`, width - 50, 65);

    // Top Panel: Large action banner
    ctx.fillStyle = '#18181b';
    ctx.fillRect(50, 90, width - 100, 340);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 3;
    ctx.strokeRect(50, 90, width - 100, 340);

    // Action speed lines inside top panel
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    for (let rad = 0; rad < Math.PI * 2; rad += 0.08) {
      const cx = 50 + (width - 100) / 2;
      const cy = 90 + 170;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * 60, cy + Math.sin(rad) * 60);
      ctx.lineTo(cx + Math.cos(rad) * 450, cy + Math.sin(rad) * 450);
      ctx.stroke();
    }
    ctx.restore();

    // Panel 1 title and art
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titles[i], width / 2, 240);

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'italic bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('⚡ HANDS-FREE EYE CONTROL TRIGGER ZONE ⚡', width / 2, 285);

    // Middle Split Panels (Left & Right)
    const midTop = 450;
    const midH = 420;
    const midW = (width - 120) / 2;

    // Left Panel
    ctx.fillStyle = '#121215';
    ctx.fillRect(50, midTop, midW, midH);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 3;
    ctx.strokeRect(50, midTop, midW, midH);

    // Speech bubble left panel
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(50 + midW / 2, midTop + 140, 150, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('"Close both eyes for 800ms', 50 + midW / 2, midTop + 125);
    ctx.fillText('to trigger the next page step!"', 50 + midW / 2, midTop + 155);

    // Right Panel
    ctx.fillStyle = '#121215';
    ctx.fillRect(50 + midW + 20, midTop, midW, midH);
    ctx.strokeRect(50 + midW + 20, midTop, midW, midH);

    // Speech bubble right panel
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(50 + midW + 20 + midW / 2, midTop + 160, 160, 95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.font = 'bold 19px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('"In Auto mode, your gaze controls', 50 + midW + 20 + midW / 2, midTop + 145);
    ctx.fillText('flow. Closing eyes pauses or', 50 + midW + 20 + midW / 2, midTop + 172);
    ctx.fillText('resumes continuous scrolling!"', 50 + midW + 20 + midW / 2, midTop + 199);

    // Bottom Panel
    const botTop = 890;
    const botH = 390;
    ctx.fillStyle = '#18181b';
    ctx.fillRect(50, botTop, width - 100, botH);
    ctx.strokeRect(50, botTop, width - 100, botH);

    // Sound effect onomatopoeia (SFX)
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 68px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(width / 2, botTop + 150);
    ctx.rotate(-0.06);
    ctx.fillText('ドドドド (DO-DO-DO)', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      i === titles.length - 1
        ? '✦ END OF CHAPTER 1 — IMPORT YOUR OWN CBZ / IMAGES VIA THE "+" BUTTON! ✦'
        : '▼ KEEP READING: CLOSE BOTH EYES TO ADVANCE SMOOTHLY ▼',
      width / 2,
      botTop + 270
    );

    // Convert canvas to Blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.92);
    });

    pages.push({
      name: `page_${String(i + 1).padStart(5, '0')}.jpg`,
      blob,
      aspectRatio: width / height,
    });
  }

  return pages;
}
