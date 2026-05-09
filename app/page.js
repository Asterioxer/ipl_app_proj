"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import iplImages from "../data/ipl_images.json";

// Dynamically import the 3D scene to avoid SSR issues
const Scene3D = dynamic(() => import("./components/Scene3D"), { ssr: false });

export default function Home() {
  const [gameState, setGameState] = useState("start"); // 'start', 'playing', 'loading', 'result'
  const [history, setHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [turn, setTurn] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [finalGuess, setFinalGuess] = useState(null);
  const [reasoning, setReasoning] = useState(null);
  const [currentBgImage, setCurrentBgImage] = useState(null);

  // Initialize with a random image
  useEffect(() => {
    if (iplImages && iplImages.length > 0) {
      setCurrentBgImage(iplImages[Math.floor(Math.random() * iplImages.length)]);
    }
  }, []);

  const startGame = async () => {
    setGameState("loading");
    setHistory([]);
    setTurn(0);
    setConfidence(0);
    await fetchNextStep([], 0);
  };

  const handleAnswer = async (answer) => {
    const newHistory = [...history, { question: currentQuestion, answer }];
    setHistory(newHistory);
    
    // Cycle to a new random image
    if (iplImages && iplImages.length > 0) {
      setCurrentBgImage(iplImages[Math.floor(Math.random() * iplImages.length)]);
    }

    setGameState("loading");
    await fetchNextStep(newHistory, turn + 1);
  };

  const fetchNextStep = async (currentHistory, currentTurn) => {
    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: currentHistory, turn: currentTurn }),
      });
      const data = await res.json();

      if (data.error) {
        console.error(data.error);
        alert("Error connecting to local ML engine.");
        setGameState("start");
        return;
      }

      const highestProb = data.candidates && data.candidates.length > 0 ? data.candidates[0].probability : 0;
      setConfidence(Math.round(highestProb * 100));

      if (data.isFinalGuess) {
        const guessName = data.finalGuessName || (data.candidates[0] ? data.candidates[0].name : "Unknown Player");
        setFinalGuess(guessName);
        setReasoning(data.reasoning);
        setGameState("result");
      } else {
        setCurrentQuestion(data.nextQuestion);
        setTurn(currentTurn);
        setGameState("playing");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to fetch next step.");
      setGameState("start");
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, y: -30, scale: 0.95, transition: { duration: 0.3 } }
  };

  return (
    <>
      <div className="bg-blobs"></div>
      <Scene3D />
      
      <main className="container">
        <AnimatePresence mode="wait">
          <motion.div 
            key={gameState}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="glass-card"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            
            {gameState === "start" && (
              <div style={{ textAlign: 'center' }}>
                <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>IPL AI Akinator</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
                  Think of an IPL player (past or present). I will ask you a series of questions and try to guess who it is in 8 questions or less!
                </p>
                <button className="btn btn-primary" onClick={startGame} style={{ fontSize: '1.2rem', padding: '1.2rem 2rem' }}>
                  Start Game
                </button>
              </div>
            )}

            {gameState === "loading" && (
              <div className="loader-container">
                <div className="spinner"></div>
                <p className="loading-text">AI is calculating entropy...</p>
              </div>
            )}

            {gameState === "playing" && (
              <div>
                <div className="confidence-wrapper">
                  <div className="confidence-header">
                    <span>Question {turn + 1} / 8</span>
                    <span>Confidence: {confidence}%</span>
                  </div>
                  <div className="confidence-track">
                    <motion.div 
                      className="confidence-fill" 
                      initial={{ width: 0 }}
                      animate={{ width: `${confidence}%` }}
                      transition={{ duration: 0.8, ease: "circOut" }}
                    />
                  </div>
                </div>

                <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}>
                  <AnimatePresence mode="wait">
                    {currentBgImage && (
                      <motion.img 
                        key={currentBgImage}
                        src={currentBgImage} 
                        alt="IPL Background"
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5 }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', position: 'absolute', top: 0, left: 0 }}
                      />
                    )}
                  </AnimatePresence>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,1) 0%, rgba(15,23,42,0) 100%)' }}></div>
                  <motion.h2 
                    key={currentQuestion}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="question-text"
                    style={{ position: 'absolute', bottom: '10px', left: '15px', right: '15px', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontSize: '1.2rem', textAlign: 'center' }}
                  >
                    "{currentQuestion}"
                  </motion.h2>
                </div>

                <div className="options-grid">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn btn-yes" onClick={() => handleAnswer("Yes")}>Yes</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn btn-no" onClick={() => handleAnswer("No")}>No</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn btn-probably" onClick={() => handleAnswer("Probably")}>Probably</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn btn-idk" onClick={() => handleAnswer("Don't Know")}>Don't Know</motion.button>
                </div>
              </div>
            )}

            {gameState === "result" && (
              <div className="result-card">
                <div className="result-badge">Final Guess</div>
                
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                  style={{ width: '150px', height: '150px', margin: '0 auto 1.5rem auto', borderRadius: '50%', overflow: 'hidden', border: '4px solid rgba(59, 130, 246, 0.5)', boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)', backgroundColor: '#000' }}
                >
                  <img src="/avatar.png" alt="Player" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </motion.div>

                <h2 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Are you thinking of...</h2>
                <motion.h1 
                  className="result-name"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {finalGuess}
                </motion.h1>
                
                {reasoning && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginTop: '1.5rem', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}
                  >
                    AI Reasoning: {reasoning}
                  </motion.div>
                )}

                <motion.button 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  className="btn btn-primary" 
                  onClick={() => setGameState("start")}
                >
                  Play Again
                </motion.button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
