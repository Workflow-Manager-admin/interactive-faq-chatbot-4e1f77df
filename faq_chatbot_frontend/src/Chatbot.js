import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "animate.css";
import { FiMessageCircle, FiMinus, FiX, FiChevronDown, FiChevronRight, FiThumbsUp, FiThumbsDown, FiSearch } from "react-icons/fi";

// Example FAQ data. Replace or load from backend as needed.
const CATEGORIZED_FAQS = [
  {
    category: "General",
    faqs: [
      {
        question: "What is this FAQ chatbot?",
        answer: "It's an interactive chatbot that answers your frequently asked questions and can connect you to AI for more help.",
      },
      {
        question: "How does the chatbot work?",
        answer: "You can type your question or pick from the FAQ list. The chatbot matches your question using keyword and fuzzy search, and responds accordingly.",
      },
    ],
  },
  {
    category: "Account",
    faqs: [
      {
        question: "How do I create an account?",
        answer: "Click on the Sign Up button in the top navigation and fill out the registration form.",
      },
      {
        question: "What if I forget my password?",
        answer: "Click on 'Forgot Password' on the login page and follow the instructions to reset your password.",
      },
    ],
  },
  {
    category: "AI Support",
    faqs: [
      {
        question: "What if my question isn’t answered?",
        answer: "If your question isn't matched with our FAQs, the chatbot can attempt an AI-powered answer. Just send your query!",
      },
    ],
  },
];

// Utilities: Simple fuzzy matcher & storage
function keywordOrFuzzyMatch(input, faqs) {
  // Returns {faq, score} pairs sorted by best score
  input = input.trim().toLowerCase();
  if (!input) return [];
  const byScore = [];
  faqs.forEach(faq => {
    const q = faq.question.toLowerCase();
    // Direct substring
    if (q.includes(input)) {
      byScore.push({ faq, score: 2 });
      return;
    }
    // Simple fuzzy: count common words
    let matchCount = 0;
    input.split(" ").forEach(w => { if (q.includes(w)) matchCount++; });
    if (matchCount > 0) {
      byScore.push({ faq, score: 1 + 0.1 * matchCount });
    }
  });
  byScore.sort((a, b) => b.score - a.score);
  return byScore;
}

function getAllFaqsList() {
  return CATEGORIZED_FAQS.flatMap(cat => cat.faqs.map(faq => ({
    ...faq,
    category: cat.category,
  })));
}

// Session chat history
const CHAT_HISTORY_KEY = "faq_chatbot_chat_history_v1";

// Framer Motion variants for sliding windows etc.
const chatbotWindowVariants = {
  hidden: { opacity: 0, y: 100, scale: 0.92, pointerEvents: "none" },
  visible: { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" },
  exit: { opacity: 0, y: 80, scale: 0.95, transition: { duration: 0.16 } },
};

const floatingButtonVariants = {
  initial: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
  tap: { scale: 0.96 }
};

// ------- Main Chatbot UI ------- //

export default function FaqChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [theme, setTheme] = useState(() => {
    let t = localStorage.getItem("faq_chatbot_theme");
    if (t) return t;
    // Prefer dark if user has dark-mode by default
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      return "dark";
    return "light";
  });
  const [search, setSearch] = useState("");
  const [faqOpenCategories, setFaqOpenCategories] = useState(() => {
    // By default all categories open
    return CATEGORIZED_FAQS.map(cat => cat.category);
  });
  const [chat, setChat] = useState(() => {
    const fromSession = sessionStorage.getItem(CHAT_HISTORY_KEY);
    if (fromSession) return JSON.parse(fromSession);
    // Welcome onboarding message
    return [
      { role: "bot", content: "👋 Hi! I'm your FAQ chatbot. Ask a question, or check the FAQs below!", timestamp: Date.now() }
    ];
  });
  const [faqMatches, setFaqMatches] = useState([]);
  const [waitingForAi, setWaitingForAi] = useState(false);
  const [errorAi, setErrorAi] = useState("");
  const chatEndRef = useRef(null);

  // Adaptive theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === "dark" ? "dark" : "light");
    localStorage.setItem("faq_chatbot_theme", theme);
  }, [theme]);

  // Persist chat to session
  useEffect(() => {
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chat));
  }, [chat]);

  // When opening chatbot, scroll to bottom
  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat, isOpen]);

  // Handle search
  useEffect(() => {
    if (search.trim() === "") {
      setFaqMatches([]);
      return;
    }
    const allFaqs = getAllFaqsList();
    setFaqMatches(keywordOrFuzzyMatch(search, allFaqs));
  }, [search]);

  // Public functions

  // PUBLIC_INTERFACE
  const handleSend = async (text) => {
    if (!text.trim()) return;
    const timestamp = Date.now();
    addChat({ role: "user", content: text, timestamp });
    // First try FAQ match
    const faqs = getAllFaqsList();
    let res = keywordOrFuzzyMatch(text, faqs);
    if (res.length && res[0].score >= 2) {
      // Direct FAQ match!  
      addBotMessage(res[0].faq.answer, res[0].faq.question);
      return;
    } else if (res.length) {
      // Suggest best-matched FAQ (but score < 2)
      addBotMessage(`I found a similar question: <b>${res[0].faq.question}</b><br /><i>${res[0].faq.answer}</i>`);
      return;
    } else {
      // Fallback to AI answer (simulate async, in production call backend API)
      setWaitingForAi(true);
      addBotMessage("Let me check with our AI...", null, true); // Temporary
      try {
        setErrorAi("");
        // Simulate delay & result
        let aiRes = await fakeAiFetch(text);
        updateLastBotMessage(aiRes);
      } catch (e) {
        setErrorAi("Sorry, couldn't fetch an AI response at the moment.");
        updateLastBotMessage(errorAi);
      }
      setWaitingForAi(false);
      return;
    }
  };

  // PUBLIC_INTERFACE
  const toggleCategory = cat => {
    setFaqOpenCategories(prev => prev.includes(cat)
      ? prev.filter(c => c !== cat)
      : [...prev, cat]);
  };

  // PUBLIC_INTERFACE
  const handleFaqClick = (faq) => {
    setSearch("");
    handleSend(faq.question);
  };

  // Add to chat
  function addChat(msg) {
    setChat(prev => [...prev, msg]);
  }
  function addBotMessage(content, questionMatched = null, isTemporary = false) {
    setChat(prev => [
      ...prev,
      {
        role: "bot",
        content,
        timestamp: Date.now(),
        questionMatched,
        isTemporary
      }
    ]);
  }
  function updateLastBotMessage(content) {
    setChat(prev => {
      let cp = [...prev];
      for (let i = cp.length - 1; i >= 0; i--) {
        if (cp[i].role === "bot") {
          cp[i] = { ...cp[i], content, isTemporary: false };
          break;
        }
      }
      return cp;
    });
  }

  // Answer Feedback
  // PUBLIC_INTERFACE
  const sendFeedback = async (msgIdx, helpful) => {
    setChat(prev =>
      prev.map((msg, idx) =>
        idx === msgIdx
          ? { ...msg, feedback: helpful }
          : msg
      )
    );
    // Optionally, send feedback to backend here (analytics)
  };

  // AI simulation (replace with real backend)
  async function fakeAiFetch(text) {
    await new Promise(res => setTimeout(res, 1200));
    // Simulate "AI" response
    return (
      "🤖 <i>This answer is generated by AI:</i><br/>" +
      "Sorry, I couldn't find a matching FAQ. Here's my best guess: <br/><b>Your question:</b> " +
      text
    );
  }

  // Window controls
  // PUBLIC_INTERFACE
  const handleToggle = () => {
    setIsOpen(v => !v);
    setIsMinimized(false);
    setTimeout(() => {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, 350);
  };
  // PUBLIC_INTERFACE
  const handleClose = () => setIsOpen(false);
  // PUBLIC_INTERFACE
  const handleMinimize = () => setIsMinimized(true);
  // PUBLIC_INTERFACE
  const handleRestore = () => { setIsMinimized(false); setIsOpen(true); };

  // Render FAQ list
  function renderFaqList() {
    // If searching, show matches only
    if (search.trim()) {
      if (faqMatches.length === 0 && search) {
        return (
          <div className="faq-empty animate__animated animate__fadeIn">
            <span>No FAQs matched. Try rewording, or send your question below!</span>
          </div>
        );
      }
      return (
        <div className="faq-search-matches">
          {faqMatches.map(({ faq }, idx) =>
            <div
              key={faq.question + idx}
              className="faq-item animate__animated animate__fadeInUp"
              tabIndex={0}
              role="button"
              onClick={() => handleFaqClick(faq)}
            >
              <strong>{faq.question}</strong>
              <div className="faq-answer">{faq.answer}</div>
            </div>
          )}
        </div>
      );
    }
    // Default: categorized
    return (
      <div className="faq-categories">
        {CATEGORIZED_FAQS.map(cat =>
          <div className="faq-category" key={cat.category}>
            <div
              className="faq-category-header"
              tabIndex={0}
              onClick={() => toggleCategory(cat.category)}
            >
              {faqOpenCategories.includes(cat.category)
                ? <FiChevronDown size={16} />
                : <FiChevronRight size={16} />}
              <span>{cat.category}</span>
            </div>
            <AnimatePresence>
              {faqOpenCategories.includes(cat.category) && (
                <motion.div
                  className="faq-category-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {cat.faqs.map(faq =>
                    <div
                      key={faq.question}
                      className="faq-item animate__animated animate__fadeInUp"
                      tabIndex={0}
                      role="button"
                      onClick={() => handleFaqClick(faq)}
                    >
                      <strong>{faq.question}</strong>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  // Render chat conversation area
  function renderChat() {
    return (
      <div className="faq-chatbot-messages" id="faq-chatbot-messages">
        {chat.map((msg, idx) => (
          <div
            className={`faq-message-row ${msg.role === "bot" ? "from-bot" : "from-user"} animate__animated animate__fadeInUp`}
            key={idx}
          >
            {msg.role === "bot" && (
              <div className="faq-message-avatar">🤖</div>
            )}
            <div className="faq-message-bubble"
              dangerouslySetInnerHTML={{ __html: msg.content }}
            />
            {msg.role === "user" && (
              <div className="faq-message-avatar">🧑</div>
            )}

            {/* Feedback for bot's answer */}
            {msg.role === "bot" && !msg.isTemporary && !msg.feedback && (
              <div className="faq-feedback">
                <button
                  className="faq-feedback-btn"
                  aria-label="Helpful"
                  onClick={() => sendFeedback(idx, true)}
                  tabIndex={0}
                  title="This was helpful"
                >
                  <FiThumbsUp />
                </button>
                <button
                  className="faq-feedback-btn"
                  aria-label="Not Helpful"
                  onClick={() => sendFeedback(idx, false)}
                  tabIndex={0}
                  title="This was not helpful"
                >
                  <FiThumbsDown />
                </button>
              </div>
            )}
            {msg.role === "bot" && msg.feedback !== undefined && (
              <div className="faq-feedback-result">
                {msg.feedback ? "Thank you for your feedback! 👍"
                  : "Sorry this wasn't helpful. We'll improve! 👎"}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    );
  }

  // Chat input
  function ChatInput() {
    const [input, setInput] = useState("");
    const inputRef = useRef();
    return (
      <form
        className="faq-chatbot-input-row"
        onSubmit={e => {
          e.preventDefault();
          if (input.trim()) {
            handleSend(input);
            setInput("");
            inputRef.current.blur();
          }
        }}
        autoComplete="off"
      >
        <input
          className="faq-chatbot-input"
          placeholder="Type your question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          ref={inputRef}
          disabled={waitingForAi}
        />
        <button
          className="faq-chatbot-send-btn"
          type="submit"
          disabled={!input || waitingForAi}
          aria-label="Send"
        >
          ▶
        </button>
      </form>
    );
  }

  // Main render
  return (
    <>
      {/* Floating button to open chatbot */}
      <AnimatePresence>
        {!isOpen &&
          <motion.button
            className="faq-chatbot-floating-btn"
            initial="initial"
            animate="visible"
            exit="initial"
            variants={floatingButtonVariants}
            transition={{ type: "spring", stiffness: 330, damping: 30 }}
            onClick={handleToggle}
            tabIndex={0}
            aria-label="Open FAQ Chatbot"
          >
            <FiMessageCircle size={28} />
          </motion.button>
        }
      </AnimatePresence>
      {/* The chat window itself */}
      <AnimatePresence>
        {isOpen &&
          <motion.div
            className={`faq-chatbot-window animate__animated ${isMinimized ? 'animate__fadeOutDown' : "animate__fadeInUp"}`}
            variants={chatbotWindowVariants}
            initial="hidden"
            animate={!isMinimized ? "visible" : "hidden"}
            exit="exit"
            transition={{ duration: 0.25 }}
            style={{ zIndex: 9999 }}
            data-theme={theme}
          >
            {/* Header */}
            <div className="faq-chatbot-header">
              <div className="faq-chatbot-title">FAQ Chatbot</div>
              <button className="faq-chatbot-header-btn" onClick={handleMinimize} title="Minimize" aria-label="Minimize">
                <FiMinus size={18} />
              </button>
              <button className="faq-chatbot-header-btn" onClick={handleClose} title="Close" aria-label="Close">
                <FiX size={18} />
              </button>
            </div>
            {/* Theme toggle */}
            <button
              className="faq-chatbot-theme-toggle"
              onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            {/* Chat and FAQ */}
            <div className="faq-chatbot-body">
              <div className="faq-chatbot-chatarea">
                {renderChat()}
              </div>
              {waitingForAi &&
                <div className="faq-chatbot-loader animate__animated animate__fadeIn animate__slower">
                  <span className="faq-chatbot-loader-dot">●</span>
                  <span className="faq-chatbot-loader-dot">●</span>
                  <span className="faq-chatbot-loader-dot">●</span>
                </div>}
              <ChatInput />
              <div className="faq-chatbot-divider" />
              <div className="faq-chatbot-faq-section">
                <div className="faq-search-row">
                  <FiSearch />
                  <input
                    className="faq-search-input"
                    placeholder="Search FAQ..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search FAQ"
                  />
                  {search &&
                    <button className="faq-search-clear-btn" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
                  }
                </div>
                {renderFaqList()}
              </div>
            </div>
            {/* Minimized state bar (visible only if minimized) */}
            {isMinimized &&
              <div className="faq-chatbot-minimized-bar" onClick={handleRestore} tabIndex={0}>
                <FiMessageCircle /> FAQ Chatbot (Click to restore)
              </div>}
          </motion.div>
        }
      </AnimatePresence>
      {/* Re-minimize button (when minimized but window closed, show docked icon) */}
      {isMinimized && !isOpen &&
        <motion.button
          className="faq-chatbot-floating-btn"
          initial="initial"
          animate="visible"
          exit="initial"
          variants={floatingButtonVariants}
          transition={{ type: "spring", stiffness: 330, damping: 30 }}
          onClick={handleRestore}
          tabIndex={0}
          aria-label="Restore FAQ Chatbot"
        >
          <FiMessageCircle size={28} />
        </motion.button>
      }
    </>
  );
}
