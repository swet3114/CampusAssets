import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import RoleGate from "../middle/RoleGate"; // Adjust path if needed

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! How can I help you?", from: "bot" },
  ]);
  const [input, setInput] = useState("");
  const [expectingAssetType, setExpectingAssetType] = useState(false);
  const navigate = useNavigate();
  const recognitionRef = useRef(null);

  function addMessage(text, from) {
    setMessages((msgs) => [...msgs, { text, from }]);
  }

  function processCommand(text) {
    const cmd = text.toLowerCase().trim();

    // Handle clarification for add asset
    if (expectingAssetType) {
      setExpectingAssetType(false);
      if (cmd.includes("bulk")) {
        navigate("/bulkasset");
        addMessage("Opening Add Bulk Asset page...", "bot");
      } else if (cmd.includes("single") || cmd.includes("one")) {
        navigate("/assets/new");
        addMessage("Opening Add Single Asset page...", "bot");
      } else {
        addMessage("Please type 'single' or 'bulk' to clarify.", "bot");
        setExpectingAssetType(true);
      }
      return;
    }

    // Handle "qr" or "scan qr"
    if (cmd === "qr" || cmd.includes("scan qr") || cmd === "scan") {
      navigate("/scan");
      addMessage("Opening Scan QR page...", "bot");
      return;
    }

    // Handle "add asset" ambiguity
    if (cmd.includes("add asset")) {
      if (cmd.includes("bulk")) {
        navigate("/bulkasset");
        addMessage("Opening Add Bulk Asset page...", "bot");
      } else if (cmd.includes("single") || cmd.includes("one")) {
        navigate("/assets/new");
        addMessage("Opening Add Single Asset page...", "bot");
      } else {
        addMessage(
          "Do you want to add a single asset or bulk assets? Please type 'single' or 'bulk'.",
          "bot"
        );
        setExpectingAssetType(true);
      }
      return;
    }

    // Handle inventory
    if (cmd.includes("inventory")) {
      if (cmd.includes("bulk")) {
        navigate("/bulk-inventory");
        addMessage("Opening Bulk Inventory page...", "bot");
      } else {
        navigate("/assets");
        addMessage("Opening Inventory page...", "bot");
      }
      return;
    }

    

    // Handle history logs
    if (cmd.includes("history")) {
      navigate("/admin/history");
      addMessage("Opening History Logs...", "bot");
      return;
    }

    // Handle dashboard
    if (cmd.includes("dashboard") || cmd === "home") {
      navigate("/");
      addMessage("Opening Dashboard...", "bot");
      return;
    }

    // Fallback
    addMessage(
      "Sorry, I didn't understand. Try commands like 'Scan QR', 'Add Asset', 'View Inventory', or 'History Logs'.",
      "bot"
    );
  }

  function handleTextSubmit() {
    if (!input.trim()) return;
    addMessage(input, "user");
    processCommand(input);
    setInput("");
  }

  function startListening() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      addMessage(spoken, "user");
      processCommand(spoken);
    };
    recognition.onerror = () => addMessage("Error with speech recognition.", "bot");
    recognition.onend = () => (recognitionRef.current = null);
    recognition.start();
    recognitionRef.current = recognition;
  }

  // --- UI Styles ---
  const chatBtnStyle = {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    background: "#6366F1",
    color: "#fff",
    fontSize: "1.5rem",
    borderRadius: "50%",
    padding: "0.85rem",
    boxShadow: "0 4px 16px rgba(0,0,0,0.20)",
    zIndex: 99999,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };
  const panelStyle = {
    position: "fixed",
    bottom: "84px",
    right: "24px",
    width: "320px",
    maxWidth: "95vw",
    maxHeight: "400px",
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: "20px",
    boxShadow: "0 8px 32px rgba(0,0,0,.23)",
    display: "flex",
    flexDirection: "column",
    zIndex: 99999
  };

  // Smaller input, send, and mic
  const inputStyle = {
    flex: 1,
    border: "1px solid #bbb",
    borderRadius: "7px",
    padding: "5px 8px",
    fontSize: "0.92rem",
    outline: "none"
  };
  const sendBtnStyle = {
    background: "#6366f1",
    color: "white",
    borderRadius: "7px",
    padding: "5px 12px",
    border: "none",
    cursor: "pointer",
    fontSize: "0.92rem"
  };
  const micBtnStyle = {
    background: "#e5e7eb",
    borderRadius: "7px",
    padding: "5px 8px",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1rem"
  };

  return (
    <>
      {/* --- Fixed Chatbot Icon --- */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={chatBtnStyle}
        title="Chat with support"
        aria-label="Chatbot"
      >
        <span role="img" aria-label="Chatbot">🤖</span>
      </button>

      {/* --- Chat Panel (role-gated) --- */}
      <RoleGate allow={["Super_Admin"]}>
        {open && (
          <div style={panelStyle}>
            <div style={{ display: "flex", alignItems: "center", padding: "11px 14px 6px 14px", borderBottom: "1px solid #eee", fontWeight: "bold" }}>
              <span style={{ flex: 1 }}>Chatbot</span>
              <button onClick={() => setOpen(false)} style={{
                background: "transparent",
                border: "none",
                fontSize: "1.1rem",
                cursor: "pointer",
                color: "#737373",
                marginLeft: 6
              }} title="Close">✖</button>
            </div>
            <div style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
              {messages.map(({ text, from }, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: "7px",
                    padding: "7px 10px",
                    maxWidth: "80%",
                    marginBottom: "5px",
                    background: from === "bot" ? "#f1f5f9" : "#6366f1",
                    color: from === "bot" ? "#222" : "#fff",
                    alignSelf: from === "bot" ? "flex-start" : "flex-end",
                    fontSize: "0.95rem"
                  }}
                >
                  {text}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "5px", borderTop: "1px solid #eee", padding: "7px 10px 7px 10px", alignItems: "center" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                style={inputStyle}
                placeholder="Type or speak..."
              />
              <button
                onClick={handleTextSubmit}
                style={sendBtnStyle}
              >
                Send
              </button>
              <button
                onClick={startListening}
                style={micBtnStyle}
                title="Start speech"
                aria-label="Mic"
              >
                <span role="img" aria-label="mic">🎤</span>
              </button>
            </div>
          </div>
        )}
      </RoleGate>
    </>
  );
}
