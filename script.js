// The State of Things
let state = {
    questions: [],
    currentIndex: 0,
    answers: [], // stores selected option index
    timestamps: [], // stores time taken per question
    timeLeft: 0,
    timerInterval: null,
    questionStartTime: 0,
    config: {
        name: "",
        markCorrect: 4,
        markWrong: 1
    }
};

// UI Toggle for Input Type
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

// Kick off the illusion
async function initializeQuiz() {
    const timeMins = parseInt(document.getElementById('test-time').value);
    state.config.name = document.getElementById('test-name').value || "Untitled Construct";
    state.config.markCorrect = parseFloat(document.getElementById('mark-correct').value);
    state.config.markWrong = parseFloat(document.getElementById('mark-wrong').value);
    
    // In a real app, this is where you call Gemini/OpenAI or parse the PDF.
    // I am generating a hardcoded mock array to prove the logic works.
    state.questions = await mockAIGeneration(); 

    if (state.questions.length === 0) return alert("No questions generated.");

    state.timeLeft = timeMins * 60;
    state.answers = new Array(state.questions.length).fill(null);
    state.timestamps = new Array(state.questions.length).fill(0);
    
    switchScreen('quiz-screen');
    document.getElementById('display-test-name').innerText = state.config.name;
    
    startTimer();
    loadQuestion(0);
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

function loadQuestion(index) {
    state.currentIndex = index;
    state.questionStartTime = Date.now(); // Mark when they started looking at it
    
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
    loadQuestion(state.currentIndex); // Re-render to show selection
}

function nextQuestion() {
    // Calculate time spent
    const timeSpentMs = Date.now() - state.questionStartTime;
    state.timestamps[state.currentIndex] += timeSpentMs; // Accumulate in case they go back (if back btn existed)
    
    if (state.currentIndex < state.questions.length - 1) {
        loadQuestion(state.currentIndex + 1);
    } else {
        finishQuiz();
    }
}

function finishQuiz() {
    clearInterval(state.timerInterval);
    
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
        li.innerHTML = `<span>Q${i + 1}: ${state.questions[i].text.substring(0, 20)}...</span> <span>${sec}s</span>`;
        timeList.appendChild(li);
    });

    switchScreen('results-screen');
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// Mocking the AI backend. You'd replace this with a fetch() call to a real AI API.
async function mockAIGeneration() {
    return [
        { text: "What is the nature of time?", options: ["A flat circle", "A line", "A cube", "An illusion"], correct: 0 },
        { text: "Which language executes in the browser natively?", options: ["Python", "Java", "JavaScript", "C++"], correct: 2 },
        { text: "What does HTML stand for?", options: ["Hyper Text Markup Language", "Heavy Text Machine Language", "Hyperlink Text Module Language", "None of the above"], correct: 0 }
    ];
}
