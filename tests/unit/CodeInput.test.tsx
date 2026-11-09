import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CodeInput } from "@/components/auth/CodeInput";

function setup() {
  const onChange = vi.fn();
  const { container } = render(
    <form>
      <CodeInput label="Doğrulama kodu" onChange={onChange} />
    </form>,
  );
  const boxes = Array.from({ length: 6 }, (_, i) => screen.getByLabelText(`Kodun ${i + 1}. rakamı`) as HTMLInputElement);
  const hidden = container.querySelector('input[name="code"]') as HTMLInputElement;
  return { onChange, boxes, hidden };
}

describe("kod kutuları", () => {
  it("her rakamdan sonra sonraki kutuya geçer, harfleri almaz", async () => {
    const { boxes, hidden, onChange } = setup();
    await userEvent.click(boxes[0]);
    await userEvent.keyboard("4a8");
    expect(boxes[0].value).toBe("4");
    expect(boxes[1].value).toBe("8");
    expect(boxes[2]).toHaveFocus();
    expect(hidden.value).toBe("48");
    expect(onChange).toHaveBeenLastCalledWith("48");
  });

  it("yapıştırılan kodun tamamı kutulara dağılır, boşluk ve tire atlanır", () => {
    const { boxes, hidden, onChange } = setup();
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => "482-913" } });
    expect(boxes.map((b) => b.value).join("")).toBe("482913");
    expect(hidden.value).toBe("482913");
    expect(onChange).toHaveBeenLastCalledWith("482913");
    expect(boxes[5]).toHaveFocus();
  });

  it("telefonun önerdiği kod ilk kutuya tek seferde gelirse dağıtılır", () => {
    const { boxes, hidden } = setup();
    fireEvent.change(boxes[0], { target: { value: "482913" } });
    expect(hidden.value).toBe("482913");
  });

  it("boş kutuda geri tuşu önceki kutuyu siler", async () => {
    const { boxes, hidden } = setup();
    await userEvent.click(boxes[0]);
    await userEvent.keyboard("12");
    expect(boxes[2]).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    expect(boxes[1]).toHaveFocus();
    expect(hidden.value).toBe("1");
  });
});
