import React, { useState, useEffect } from 'react';
import './App.css';
import FaqChatbot from './Chatbot';

// PUBLIC_INTERFACE
function App() {
  // The only content: the floating FAQ chatbot UI
  return (
    <div className="App" style={{ minHeight: "100vh" }}>
      {/* Optionally place site content here */}
      <FaqChatbot />
    </div>
  );
}

export default App;
