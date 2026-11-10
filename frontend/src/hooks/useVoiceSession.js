import { useEffect, useRef, useState } from "react";
import { VoiceController, initialUi } from "../lib/VoiceController.js";

export function useVoiceSession() {
  const [ui, setUi] = useState(initialUi);
  const ref = useRef(null);
  if (!ref.current) ref.current = new VoiceController(p => setUi(prev => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) })));
  useEffect(() => {
    const c = ref.current; c.destroyed = false; c.init();
    return () => c.destroy();
  }, []);
  return { ui, ctl: ref.current, supports: ref.current.supports };
}
