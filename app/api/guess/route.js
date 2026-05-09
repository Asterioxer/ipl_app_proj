import players from '../../../data/players.json' with { type: 'json' };
import questions from '../../../data/questions.json' with { type: 'json' };

export async function POST(req) {
  try {
    const body = await req.json();
    const { history, turn } = body;

    // 1. Initialize Probabilities
    let probabilities = players.map(p => ({
      name: p.name,
      attributes: p.attributes,
      p: 1.0 / players.length
    }));

    // 2. Apply Bayes Theorem based on history
    const askedAttributes = new Set();

    for (const { question, answer } of history) {
      // Find which attribute this question corresponds to
      let attributeKey = null;
      for (const [key, qText] of Object.entries(questions)) {
        if (qText === question) {
          attributeKey = key;
          break;
        }
      }

      if (attributeKey) {
        askedAttributes.add(attributeKey);
        
        let sumP = 0;
        for (let player of probabilities) {
          const hasAttr = player.attributes[attributeKey];
          
          let likelihood = 0.5; // default for Don't Know
          if (answer === "Yes") {
            likelihood = hasAttr ? 0.95 : 0.05;
          } else if (answer === "No") {
            likelihood = !hasAttr ? 0.95 : 0.05;
          } else if (answer === "Probably") {
            likelihood = hasAttr ? 0.75 : 0.25;
          }

          player.p = player.p * likelihood;
          sumP += player.p;
        }

        // Normalize
        if (sumP > 0) {
          for (let player of probabilities) {
            player.p = player.p / sumP;
          }
        }
      }
    }

    // Sort by highest probability
    probabilities.sort((a, b) => b.p - a.p);
    
    const topCandidate = probabilities[0];
    const topP = topCandidate.p;

    // 3. Check for Final Guess
    if (topP >= 0.80 || turn >= 8) {
      return new Response(JSON.stringify({
        candidates: probabilities.slice(0, 5).map(p => ({ name: p.name, probability: p.p })),
        isFinalGuess: true,
        nextQuestion: null,
        finalGuessName: topCandidate.name,
        reasoning: `Mathematical confidence reached ${(topP * 100).toFixed(1)}%.`
      }), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }

    // 4. Calculate Information Gain to pick the best next question
    let scoredQuestions = [];

    for (const [key, qText] of Object.entries(questions)) {
      if (askedAttributes.has(key)) continue;

      let yesProbMass = 0;
      for (let player of probabilities) {
        if (player.attributes[key]) {
          yesProbMass += player.p;
        }
      }

      const score = Math.abs(0.5 - yesProbMass);
      
      // Only consider viable questions
      if (yesProbMass > 0.01 && yesProbMass < 0.99) {
        scoredQuestions.push({ key, score });
      }
    }

    scoredQuestions.sort((a, b) => a.score - b.score);

    if (scoredQuestions.length === 0) {
      return new Response(JSON.stringify({
        candidates: probabilities.slice(0, 5).map(p => ({ name: p.name, probability: p.p })),
        isFinalGuess: true,
        nextQuestion: null,
        finalGuessName: topCandidate.name,
        reasoning: "No more useful questions to ask."
      }), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }

    // Variety of roots: Randomize among top 4 questions for the first 3 turns
    let selectedAttribute;
    if (turn < 3 && scoredQuestions.length >= 4) {
      const randomIndex = Math.floor(Math.random() * Math.min(4, scoredQuestions.length));
      selectedAttribute = scoredQuestions[randomIndex].key;
    } else {
      selectedAttribute = scoredQuestions[0].key;
    }

    return new Response(JSON.stringify({
      candidates: probabilities.slice(0, 5).map(p => ({ name: p.name, probability: p.p })),
      isFinalGuess: false,
      nextQuestion: questions[selectedAttribute],
      finalGuessName: null,
      reasoning: null
    }), { status: 200, headers: { 'Content-Type': 'application/json' }});

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred during ML processing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
