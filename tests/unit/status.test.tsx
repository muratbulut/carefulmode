import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mail } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/status/EmptyState";
import { RetryButton } from "@/components/status/RetryButton";
import { StatusCard } from "@/components/status/StatusCard";

describe("durum bileşenleri", () => {
  it("durum kartı başlığı, açıklamayı ve eylemi gösterir", () => {
    render(
      <StatusCard Icon={Mail} tone="purple" title="Lab açılamadı" action={<button type="button">Labı yeniden aç</button>}>
        Puanın ve ilerlemen etkilenmedi.
      </StatusCard>,
    );
    expect(screen.getByText("Lab açılamadı")).toBeInTheDocument();
    expect(screen.getByText("Puanın ve ilerlemen etkilenmedi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Labı yeniden aç" })).toBeInTheDocument();
  });

  it("boş durum sıradaki adımı söyler", () => {
    render(<EmptyState Icon={Mail} title="Henüz sınıfın yok" action={<a href="/siniflar/yeni">Sınıf oluştur</a>} />);
    expect(screen.getByText("Henüz sınıfın yok")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sınıf oluştur" })).toHaveAttribute("href", "/siniflar/yeni");
  });

  it("Tekrar dene: başarılı denemede Bağlandı yazar", async () => {
    const onRetry = vi.fn().mockResolvedValue(true);
    render(<RetryButton onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(await screen.findByText("Bağlandı")).toBeInTheDocument();
  });

  it("Tekrar dene: başarısız denemede düğme geri gelir", async () => {
    const onRetry = vi.fn().mockRejectedValue(new Error("yok"));
    render(<RetryButton onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});
