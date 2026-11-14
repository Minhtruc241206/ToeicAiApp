
        const state = {
            apiKey: '',
            vocabList: [],
            quizData: [], // Format from Gemini API
            userAnswers: {}, // { qIndex: optIndex }
        };

        // --- DOM Elements ---
        const views = {
            setup: document.getElementById('view-setup'),
            loading: document.getElementById('view-loading'),
            quiz: document.getElementById('view-quiz'),
            results: document.getElementById('view-results')
        };
        const inputApiKey = document.getElementById('api-key-input');
        const inputVocab = document.getElementById('vocab-input');
        const btnGenerate = document.getElementById('btn-generate');
        const quizContainer = document.getElementById('quiz-container');
        const btnFinish = document.getElementById('btn-finish');
        const toastContainer = document.getElementById('toast-container');

        // --- Event Listeners ---
        btnGenerate.addEventListener('click', startQuizGeneration);
        btnFinish.addEventListener('click', showResultsView);
        document.getElementById('btn-restart').addEventListener('click', resetApp);

        // --- Utility ---
        function switchView(viewName) {
            Object.values(views).forEach(el => el.classList.add('hidden'));
            views[viewName].classList.remove('hidden');
        }

        function showToast(message, type = 'error') {
            const toast = document.createElement('div');
            const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
            toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-[-20px] opacity-0`;
            toast.textContent = message;
            toastContainer.appendChild(toast);

            // Animate in
            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-[-20px]', 'opacity-0');
            });

            // Remove after delay
            setTimeout(() => {
                toast.classList.add('opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        // --- Core Logic ---
        async function startQuizGeneration() {
            state.apiKey = inputApiKey.value.trim();
            const rawText = inputVocab.value.trim();

            if (!state.apiKey) {
                // If in an environment that auto-injects, we could allow empty,
                // but since user requested a field, we'll enforce it to ensure it runs correctly everywhere.
                showToast("Please enter your Gemini API Key.");
                inputApiKey.focus();
                return;
            }

            if (!rawText) {
                showToast("Please enter a list of vocabulary words.");
                inputVocab.focus();
                return;
            }

            // Parse words, remove empty strings
            state.vocabList = rawText.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length > 0);

            if (state.vocabList.length === 0) {
                showToast("Could not find valid words. Please check your formatting.");
                return;
            }

            switchView('loading');

            try {
                await fetchFromGeminiAPI();
                if (state.quizData && state.quizData.length > 0) {
                    renderQuiz();
                } else {
                    throw new Error("API returned empty data.");
                }
            } catch (error) {
                console.error("Quiz Gen Error:", error);
                showToast(`Error: ${error.message}`);
                switchView('setup');
            }
        }

        async function fetchFromGeminiAPI() {
            // Using gemini-3-flash-preview for text generation as per best practices
            const modelName = 'gemini-4-hydrogen';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${state.apiKey}`;

            const systemInstruction = `You are a strict TOEIC English vocabulary tester.
The user will provide a list of English words.
Your task is to generate a multiple-choice test based ONLY on those words.
Rules for EVERY question:
1. The question must be a complete English sentence with a blank space represented by "______".
2. The context of the sentence must reflect real TOEIC test scenarios (Business, Meetings, HR, Travel, Office, Customer Service).
3. Provide exactly 4 options.
4. ALL 4 options (the correct answer and the 3 distractors) MUST be chosen strictly from the vocabulary list provided by the user. Do not use any words outside the provided list.
5. The correct answer must logically fit the blank perfectly, while the other 3 words from the list act as distractors.
6. Randomize the position of the correct answer among the 4 options so it is not always in the same place.
7. Return the data as a JSON array matching the provided schema exactly.`;

            const userPrompt = `Here is my vocabulary list: \n${state.vocabList.join(', ')}\n\nCreate a TOEIC quiz covering these words. Limit to maximum 25 questions. Ensure high quality context.`;

            const payload = {
                contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "question": { "type": "STRING", "description": "The TOEIC sentence with a blank ______" },
                                "options": { "type": "ARRAY", "items": { "type": "STRING" }, "description": "Exactly 4 string options." },
                                "correctIndex": { "type": "INTEGER", "description": "Index (0-3) of the correct answer in the options array." },
                                "translation": { "type": "STRING", "description": "Vietnamese translation of the complete sentence." },
                                "explanation": { "type": "STRING", "description": "Detailed explanation in Vietnamese of why the correct answer fits and why others don't." }
                            },
                            "required": ["question", "options", "correctIndex", "translation", "explanation"]
                        }
                    }
                }
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const jsonText = candidate.content.parts[0].text;
                state.quizData = JSON.parse(jsonText);

                // Shuffle questions slightly
                state.quizData.sort(() => Math.random() - 0.5);
            } else {
                throw new Error("Invalid response format from Gemini API.");
            }
        }

        function renderQuiz() {
            state.userAnswers = {};
            quizContainer.innerHTML = '';
            document.getElementById('total-q-count').textContent = state.quizData.length;
            updateProgress();

            state.quizData.forEach((q, qIndex) => {
                const card = document.createElement('div');
                card.className = 'bg-white rounded-xl shadow-sm border border-slate-200 p-6';
                card.id = `question-card-${qIndex}`;

                // Question Text
                const qText = document.createElement('h3');
                qText.className = 'text-lg font-medium text-slate-800 mb-5 leading-relaxed';
                qText.innerHTML = `<span class="text-indigo-600 font-bold mr-2">Q${qIndex + 1}.</span> ${q.question}`;
                card.appendChild(qText);

                // Options Container
                const optionsGrid = document.createElement('div');
                optionsGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

                q.options.forEach((optStr, optIndex) => {
                    const optEl = document.createElement('div');
                    const letter = String.fromCharCode(65 + optIndex); // A, B, C, D

                    optEl.className = 'quiz-option bg-white border-2 border-slate-200 rounded-lg p-4 flex items-center cursor-pointer';
                    optEl.innerHTML = `
                        <div class="option-box">${letter}</div>
                        <span class="font-medium flex-grow text-slate-700">${optStr}</span>
                        <div class="status-icon ml-3 hidden font-bold text-lg"></div>
                    `;

                    // Click handler
                    optEl.addEventListener('click', () => handleOptionClick(qIndex, optIndex, optEl));

                    optionsGrid.appendChild(optEl);
                });

                card.appendChild(optionsGrid);
                quizContainer.appendChild(card);
            });

            // Reset button
            btnFinish.disabled = true;
            btnFinish.className = "bg-slate-300 text-slate-500 cursor-not-allowed font-bold py-4 px-10 rounded-xl shadow-sm transition-colors text-lg";

            switchView('quiz');
            window.scrollTo(0, 0);
        }

        function handleOptionClick(qIndex, selectedOptIndex, clickedElement) {
            // Prevent changing answer once selected
            if (state.userAnswers[qIndex] !== undefined) return;

            state.userAnswers[qIndex] = selectedOptIndex;
            const qData = state.quizData[qIndex];
            const isCorrect = (selectedOptIndex === qData.correctIndex);

            // Lock all options for this question
            const card = document.getElementById(`question-card-${qIndex}`);
            const allOptions = card.querySelectorAll('.quiz-option');

            allOptions.forEach(opt => {
                opt.classList.add('answered'); // Prevents hover styles
            });

            // Handle UI styling for selected item
            const statusIcon = clickedElement.querySelector('.status-icon');
            statusIcon.classList.remove('hidden');

            if (isCorrect) {
                clickedElement.classList.add('correct');
                statusIcon.innerHTML = '✓';
            } else {
                clickedElement.classList.add('incorrect');
                statusIcon.innerHTML = '✗';

                // Highlight the actual correct answer in green
                const correctElement = allOptions[qData.correctIndex];
                correctElement.classList.add('correct');
                const correctIcon = correctElement.querySelector('.status-icon');
                correctIcon.innerHTML = '✓';
                correctIcon.classList.remove('hidden');
            }

            updateProgress();
        }

        function updateProgress() {
            const answered = Object.keys(state.userAnswers).length;
            const total = state.quizData.length;
            document.getElementById('current-q-count').textContent = answered;

            if (answered === total) {
                btnFinish.disabled = false;
                btnFinish.className = "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer font-bold py-4 px-10 rounded-xl shadow-md transition-colors text-lg animate-pulse hover:animate-none";
            }
        }

        function showResultsView() {
            let correctCount = 0;
            const explanationsHtml = [];

            state.quizData.forEach((q, index) => {
                const userChoice = state.userAnswers[index];
                const isCorrect = userChoice === q.correctIndex;

                if (isCorrect) correctCount++;

                // Build explanation card for ALL questions (so user learns from both correct/incorrect)
                const userWord = userChoice !== undefined ? q.options[userChoice] : "None";
                const correctWord = q.options[q.correctIndex];
                const borderClass = isCorrect ? 'border-green-200' : 'border-red-200';
                const headerBg = isCorrect ? 'bg-green-50' : 'bg-red-50';
                // Lấp đáp án đúng vào chỗ trống để AI đọc thành câu hoàn chỉnh
const fullSentence = q.question.replace(/_+/g, correctWord);
const safeSentence = fullSentence.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                explanationsHtml.push(`
                    <div class="bg-white rounded-xl shadow-sm border ${borderClass} overflow-hidden">
                        <div class="p-5 border-b border-slate-100 ${headerBg}">
                            <p class="font-medium text-slate-900 mb-3 text-lg"><span class="font-bold mr-2 ${isCorrect ? 'text-green-600' : 'text-red-500'}">Q${index + 1}.</span>${q.question}</p>
                            <!-- KHU VỰC NÚT NGHE AUDIO NẰM Ở ĐÂY 👇 -->
    <div class="flex items-center space-x-3 mb-4">
        <button onclick="playAudio('${safeSentence}', 'US')" class="flex items-center px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-lg text-xs font-bold transition border border-slate-200 hover:border-blue-200 shadow-sm">
            <span class="text-lg mr-1.5">🇺🇸</span> US Audio
            <svg class="w-3.5 h-3.5 ml-1.5" ...></svg>
        </button>
        <button onclick="playAudio('${safeSentence}', 'UK')" class="flex items-center px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-bold transition border border-slate-200 hover:border-rose-200 shadow-sm">
            <span class="text-lg mr-1.5">🇬🇧</span> UK Audio
            <svg class="w-3.5 h-3.5 ml-1.5" ...></svg>
        </button>
    </div>
    <!-- KẾT THÚC NÚT AUDIO 👆 -->
                            <div class="flex flex-col sm:flex-row gap-4 text-sm mt-4">
                                <div class="flex items-center px-4 py-2 rounded-lg border ${isCorrect ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'}">
                                    <span class="mr-2">${isCorrect ? '✓ You answered:' : '✗ You answered:'}</span> <span class="font-bold">${userWord}</span>
                                </div>

                                ${!isCorrect ? `
                                <div class="flex items-center bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg">
                                    <span class="mr-2">✓ Correct:</span> <span class="font-bold">${correctWord}</span>
                                </div>` : ''}

                            </div>
                        </div>
                        <div class="p-5 space-y-4 text-sm text-slate-700 bg-slate-50">
                            <div>
                                <h4 class="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-2">
                                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
                                    Translation
                                </h4>
                                <p class="italic text-slate-600 bg-white p-3 rounded border border-slate-200">${q.translation}</p>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-2">
                                    <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Explanation
                                </h4>
                                <p class="leading-relaxed bg-white p-3 rounded border border-slate-200">${q.explanation}</p>
                            </div>
                        </div>
                    </div>
                `);
            });

            const total = state.quizData.length;
            const accuracy = Math.round((correctCount / total) * 100);

            // Update stats
            document.getElementById('res-total').textContent = total;
            document.getElementById('res-correct').textContent = correctCount;
            document.getElementById('res-incorrect').textContent = total - correctCount;
            document.getElementById('res-accuracy').textContent = `${accuracy}%`;

            // Inject explanations
            document.getElementById('mistakes-container').innerHTML = `
                <h3 class="text-xl font-bold text-slate-900 mb-4 border-b pb-2">Detailed Review</h3>
                ${explanationsHtml.join('')}
            `;

            switchView('results');
            window.scrollTo(0, 0);
        }

        function resetApp() {
            // Keep the API key in the input so user doesn't have to re-enter it
            state.quizData = [];
            state.userAnswers = {};
            inputVocab.value = '';
            switchView('setup');
            window.scrollTo(0, 0);
        }
        /**
         * HÀM PHÁT ÂM THANH (TEXT-TO-SPEECH)
         */
        function playAudio(text, accent) {
            // Kiểm tra xem trình duyệt có hỗ trợ không
            if (!('speechSynthesis' in window)) {
                alert("Rất tiếc, trình duyệt của bạn không hỗ trợ tính năng đọc văn bản.");
                return;
            }

            // Dừng ngay âm thanh đang đọc dở (nếu người dùng bấm liên tục)
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);

            // Cài đặt giọng US hoặc UK
            utterance.lang = accent === 'UK' ? 'en-GB' : 'en-US';

            // Giảm tốc độ đọc xuống một chút (0.9) để nghe rõ ràng như băng TOEIC
            utterance.rate = 0.9;
            utterance.pitch = 1.0;

            // Tìm giọng đọc chuẩn (ưu tiên giọng tự nhiên của hệ điều hành/Google)
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const targetVoice = voices.find(v => v.lang === utterance.lang && (v.name.includes('Google') || v.name.includes('Natural')))
                                 || voices.find(v => v.lang === utterance.lang);
                if (targetVoice) utterance.voice = targetVoice;
            }

            // Phát âm thanh
            window.speechSynthesis.speak(utterance);
        }

