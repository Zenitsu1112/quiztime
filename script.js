// ==========================================
// 1. THE STATE OF THINGS
// ==========================================
let state = {
    questions: [],
    currentIndex: 0,
    answers: [],           // Stores selected option index (0, 1, 2, 3)
    timestamps: [],        // Stores cumulative milliseconds taken per question
    timeLeft: 0,
    timerInterval: null,
    questionStartTime: 0,
    config: {
        name: "",
        markCorrect: 4,
        markWrong: 1
    }
};

// ==========================================
// 2. UI TRANSITIONS & SOURCE TOGGLING
// ==========================================
function toggleSource() {
    const type = document.getElementById('source-type').value;
    const input = document.getElementById('source-input');
    const file = document.getElementById('file-input');
    
    if (type === 'file') {
        input.style.display = 'none';
        file.style.display = 'block';
    } else {
        input.style.display = 'block';
        file.style.display = 'none';
        input.placeholder = type === 'topic' ? "Enter a topic for the AI..." : "Paste raw text here...";
    }
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ==========================================
// 3. QUIZ INITIALIZATION & CORE LOOP
// ==========================================
async function initializeQuiz() {
    const timeMins = parseInt(document.getElementById('test-time').value) || 10;
    state.config.name = document.getElementById('test-name').value || "Untitled Construct";
    state.config.markCorrect = parseFloat(document.getElementById('mark-correct').value) || 4;
    state.config.markWrong = parseFloat(document.getElementById('mark-wrong').value) || 1;
    
    // Call the direct Hugging Face API connection
    state.questions = await mockAIGeneration(); 

    if (!state.questions || state.questions.length === 0) return;

    state.timeLeft = timeMins * 60;
    state.answers = new Array(state.questions.length).fill(null);
    state.timestamps = new Array(state.questions.length).fill(0);
    
    switchScreen('quiz-screen');
    document.getElementById('display-test-name').innerText = state.config.name;
    
    startTimer();
    loadQuestion(0, true); // True balances the tracking anchor for the first question
}

function startTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
        state.timeLeft--;
        updateTimerDisplay();
        if (state.timeLeft <= 0) {
            clearInterval(state.timerInterval);
            finishQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
    const s = (state.timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').innerText = `${m}:${s}`;
}

// Fixed: Added isNewQuestion parameter to isolate selection redraws from timeline resets
function loadQuestion(index, isNewQuestion = true) {
    state.currentIndex = index;
    if (isNewQuestion) {
        state.questionStartTime = Date.now(); 
    }
    
    const q = state.questions[index];
    document.getElementById('question-text').innerText = q.text;
    document.getElementById('progress-text').innerText = `${index + 1} / ${state.questions.length}`;
    
    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = '';
    
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn' + (state.answers[index] === i ? ' selected' : '');
        btn.innerText = opt;
        btn.onclick = () => selectOption(i);
        optsContainer.appendChild(btn);
    });

    document.getElementById('next-btn').innerText = index === state.questions.length - 1 ? "SUBMIT" : "NEXT";
}

function selectOption(optIndex) {
    state.answers[state.currentIndex] = optIndex;
    loadQuestion(state.currentIndex, false); // False preserves original question entry timestamp
}

function nextQuestion() {
    // Commit current question's viewing delta to timeline storage
    const timeSpentMs = Date.now() - state.questionStartTime;
    state.timestamps[state.currentIndex] += timeSpentMs;
    
    if (state.currentIndex < state.questions.length - 1) {
        loadQuestion(state.currentIndex + 1, true);
    } else {
        finishQuiz();
    }
}

// Optional: Easily navigate backwards if a previous button is mapped in the interface HTML
function prevQuestion() {
    const timeSpentMs = Date.now() - state.questionStartTime;
    state.timestamps[state.currentIndex] += timeSpentMs;
    
    if (state.currentIndex > 0) {
        loadQuestion(state.currentIndex - 1, true);
    }
}

// ==========================================
// 4. METRIC COMPILATION & FINISH
// ==========================================
function finishQuiz() {
    clearInterval(state.timerInterval);
    
    // Fixed: Capture final remaining question look-time on submission or timeout
    const finalDeltaMs = Date.now() - state.questionStartTime;
    if (state.currentIndex < state.timestamps.length) {
        state.timestamps[state.currentIndex] += finalDeltaMs;
    }
    
    let score = 0;
    let correctCount = 0;
    let attemptCount = 0;

    state.questions.forEach((q, i) => {
        if (state.answers[i] !== null) {
            attemptCount++;
            if (state.answers[i] === q.correct) {
                score += state.config.markCorrect;
                correctCount++;
            } else {
                score -= state.config.markWrong;
            }
        }
    });

    document.getElementById('final-score').innerText = score;
    document.getElementById('accuracy').innerText = attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0;

    const timeList = document.getElementById('time-analysis-list');
    timeList.innerHTML = '';
    state.timestamps.forEach((ms, i) => {
        const sec = (ms / 1000).toFixed(1);
        const li = document.createElement('li');
        li.innerHTML = `<span>Q${i + 1}: ${state.questions[i].text.substring(0, 25)}...</span> <span>${sec}s</span>`;
        timeList.appendChild(li);
    });

    switchScreen('results-screen');
}

// ==========================================
// 5. SERVERLESS HUGGING FACE API CONNECTOR
// ==========================================
async function mockAIGeneration() {
    // ⚠️ TODO: Replace with your actual read token from huggingface.co/settings/tokens
    const HF_TOKEN = "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"; 
    
    const sourceType = document.getElementById('source-type').value;
    let inputData = "";

    if (sourceType === 'file') {
        alert("File binary scanning requires a dedicated server node. Please use 'Topic' or 'Raw Text' configurations for standalone execution!");
        return [];
    } else {
        inputData = document.getElementById('source-input').value.trim();
        if (!inputData) {
            alert(`Please supply your contextual prompt or ${sourceType} criteria.`);
            return [];
        }
    }

    // Toggle dynamic interface UI loader indicator on initialization action trigger
    const startBtn = document.getElementById('start-quiz-btn');
    const originalText = startBtn ? startBtn.innerText : "Start Quiz";
    if (startBtn) startBtn.innerText = "AI Generation Active...";

    try {
        const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "Qwen/Qwen2.5-72B-Instruct", 
                messages: [
                    {
                        role: "system",
                        content: `You are a strict technical quiz engine. Output a valid raw JSON array containing exactly 3 multi-choice questions based directly on the provided user criteria. Do NOT format with markdown syntax, tags, blocks, or wrap in \`\`\`json. Send clean raw parsing tokens only.
                        
                        Structural Requirements Blueprint:
                        [
                          {
                            "text": "The complete declarative question?",
                            "options": ["Choice Sequence A", "Choice Sequence B", "Choice Sequence C", "Choice Sequence D"],
                            "correct": 0
                          }
                        ]`
                    },
                    {
                        role: "user",
                        content: `Target Subject Parameters: ${inputData}`
                    }
                ],
                max_tokens: 1000,
                temperature: 0.6
            })
        });

        if (!response.ok) throw new Error(`Inference interface rejection: ${response.statusText}`);

        const data = await response.json();
        const rawOutput = data.choices[0].message.content.trim();
        
        // Backup safety strip parameter execution to handle edge case structural wrap leaking
        const strictCleanJSON = rawOutput.replace(/```json|```/g, "").trim();
        
        const outputPayloadArray = JSON.parse(strictCleanJSON);
        return outputPayloadArray;

    } catch (err) {
        console.error("Direct connection framework transaction breakdown:", err);
        alert("Failed to intercept operational token parameters from the model cluster. Verify configuration variables.");
        return [];
    } finally {
        if (startBtn) startBtn.innerText = originalText;
    }
}
