"use client";

import { useEffect } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  opacity: number;
  scale: number;
  type: "envelope" | "sparkle" | "whatsapp";
};

export function ProspectingVfxCanvas() {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.id = "prospecting-vfx-canvas";
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    const particles: Particle[] = [];
    let lastMouseX = 0;
    let lastMouseY = 0;
    let mouseSpeed = 0;
    let lastCreatedTime = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      mouseSpeed = Math.sqrt(dx * dx + dy * dy);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      const now = performance.now();
      // Throttle: gera no máximo 1 partícula a cada 65ms ou se o movimento for nítido
      if (now - lastCreatedTime < 65 || mouseSpeed < 6) {
        return;
      }
      lastCreatedTime = now;

      const angle = (Math.random() - 0.5) * 1.5;
      const speed = Math.random() * 1.2 + 0.4;
      const particleTypes: Particle["type"][] = ["envelope", "sparkle", "envelope"];
      const chosenType = particleTypes[Math.floor(Math.random() * particleTypes.length)];

      particles.push({
        x: e.clientX,
        y: e.clientY,
        vx: Math.sin(angle) * speed + (dx * 0.03),
        vy: -Math.abs(Math.cos(angle) * speed) - 0.8, // flutua suavemente para cima
        size: Math.random() * 4 + 11, // tamanho mais compacto
        rotation: (Math.random() - 0.5) * 0.5,
        vRot: (Math.random() - 0.5) * 0.05,
        opacity: 0.85,
        scale: Math.random() * 0.3 + 0.7,
        type: chosenType,
      });

      if (particles.length > 25) {
        particles.splice(0, particles.length - 25);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Função de desenho de envelope 3D estilizado
    function drawEnvelope(x: number, y: number, size: number, rotation: number, opacity: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;

      const w = size * 1.3;
      const h = size * 0.9;

      // Sombra suave
      ctx.shadowColor = "rgba(220, 38, 38, 0.4)";
      ctx.shadowBlur = 8;

      // Corpo do envelope (Branco premium com borda vermelha/dourada)
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 2.5);
      ctx.fill();
      ctx.stroke();

      // Aba superior (Triângulo do envelope)
      ctx.fillStyle = "#fef2f2";
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(0, h * 0.15);
      ctx.lineTo(w / 2, -h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Selo pequeno de WhatsApp ou coração comercial no meio
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(0, h * 0.15, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawSparkle(x: number, y: number, size: number, opacity: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "#fbbf24"; // Dourado prosperidade
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Raios brilhantes
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-size * 0.6, 0);
      ctx.lineTo(size * 0.6, 0);
      ctx.moveTo(0, -size * 0.6);
      ctx.lineTo(0, size * 0.6);
      ctx.stroke();

      ctx.restore();
    }

    function drawWhatsappIcon(x: number, y: number, size: number, rotation: number, opacity: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;

      // Círculo Verde WhatsApp com brilho de mensagem chegando
      ctx.fillStyle = "#22c55e";
      ctx.shadowColor = "rgba(34, 197, 94, 0.6)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Ponto de fala branco
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;
        p.opacity -= 0.028; // fade out mais rápido
        p.vy -= 0.015; // flutuação suave

        if (p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        if (p.type === "envelope") {
          drawEnvelope(p.x, p.y, p.size * p.scale, p.rotation, p.opacity);
        } else if (p.type === "whatsapp") {
          drawWhatsappIcon(p.x, p.y, p.size * p.scale, p.rotation, p.opacity);
        } else {
          drawSparkle(p.x, p.y, p.size, p.opacity);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    };
  }, []);

  return null;
}
