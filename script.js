(function () {
    const errorDiv = watchErrors();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const maxPeriodSecs = 10;

    if (isBrowserSupported()) {
        return main();
    }
    else {
        return browserMessage();
    }

    function main() {
        const context = new AudioContext();
        initUi();
        setTimeout(begin, 500);

        function begin() {
            var source = null;
            var timer = null;
            const pickNextNote = noteGen();

            attachButton(onStartStopClick);
            updateButton(source);
            return;

            function start() {
                stop();
                nextNote();
            }

            function stop() {
                if (timer) clearTimeout(timer);
                if (source) {
                    source.stop();
                    source = null;
                }
            }

            function nextNote() {
                const options = getOptions()

                if (source) {
                    source.stop()
                }

                const [noteNum, noteName, string] = pickNextNote(options);
                document.getElementById("note").innerText = noteName;
                document.getElementById("hint").innerText = options.stringHint ? `(string ${string+1})` : "\u00A0";
                source = playNote(noteNum, context);

                timer = setTimeout(nextNote, options.periodSecs*1000);
            }

        
            function onStartStopClick() {
                if (context.state != "running") {
                    context.resume().then(onStartStopClick);
                }
                else {
                    source ? stop() : start();
                    updateButton(source);
                }
            }

        }
    }

    function noteGen() {
        const notes = "C2D4EF1G3A5B";
        const subscripts = "₀₁₂₃₄₅₆₇₈₉";
        const stringNotes = [64, 59, 55, 50, 45, 40]; // from string 1 .. 6

        var currentNote;

        function pickNextNote(options) {
            const [nextNote, string] = differentRandomNote();
            currentNote = nextNote;

            return [
                currentNote, 
                nameFor(currentNote), 
                string
            ];

            function differentRandomNote() {
                var nextNote, string;
                var attempt = 0;
                while (true) {
                    [nextNote, string] = randomNote();
                    const isAllowed = options.sharpsFlats || isNaturalNote(nextNote);
                    if (isAllowed && nextNote != currentNote) {
                        break;
                    }
                    else if (attempt > 10 && nextNote == currentNote) {
                        break; // accept current note before...
                    }
                    else if (attempt > 20) {
                        break; // ... accept disallowed note
                    }
                    ++attempt;
                }
                return [nextNote, string];
            }

            function randomNote() {
                const fret = randInt(options.minFret, options.maxFret+1);
                const string = randChoice(options.strings) || 0;
                return [stringNotes[string] + fret, string];
            }
        }

        function nameFor(midiNote) {
            const ioct = Math.floor(midiNote / 12) - 1;
            const inote = midiNote % 12;
            var noteStr = notes.charAt(inote);
            const sharpIndex = parseInt(notes.charAt(inote));
            if (!isNaN(sharpIndex)) {
                // Tend towards whichever is the more common sharp or flat for a note:
                const goSharp = randInt(1, 7) > sharpIndex;
                // no need to wrap cos B/C have nothing between:
                noteStr = notes.charAt(inote + (goSharp?-1:1)) + "♭♯".charAt(goSharp);
            }
            return noteStr + subscripts.charAt(ioct);
        }

        function isNaturalNote(midiNote) {
            var inote = midiNote % 12;
            const sharpIndex = parseInt(notes.charAt(inote));
            return isNaN(sharpIndex);
        }

        return pickNextNote;
    }


    function randInt(min, maxExcl) {
        return Math.floor(Math.random() * (maxExcl - min) + min);
    }
    
    function randChoice(array) {
        return array[randInt(0, array.length)];
    }

    function getOptions() {
        const inputs = [...document.querySelectorAll('table input')];
        const options = Object.fromEntries(inputs.map(input => [
            input.id, input.hasAttribute("checked") 
                ? input.checked 
                : Math.max(0, parseInt(input.value))
        ]));
        options.strings = Object.entries(options)
            .map(([k, v]) => (k.startsWith("string_") && v) ? parseInt(k.charAt("string_".length))-1 : undefined)
            .filter(i => i !== undefined)
        return options;
    }

    function playNote(midiNote, context) {
        source = context.createBufferSource();
        source.connect(context.destination);
        source.buffer = createBuffer(context, midiNote);
        source.start();
        return source;
    }

    function attachButton(onClick) {
        const button = document.getElementById("start-stop");
        button.onclick = onClick;
    }


    function updateButton(source) {
        const button = document.getElementById("start-stop");
        button.innerText = source ? "Stop" : "Start";
        button.className = source ? "stop" : "start";
    }

    function createBuffer(context, midiNote) {
        const sr = context.sampleRate;
        const numBufferSamps = Math.round(sr * maxPeriodSecs);
        const buffer = context.createBuffer(1, numBufferSamps, sr);
        writeNote(buffer.getChannelData(0), numBufferSamps, sr, midiNote);
        return buffer;
    }

    function writeNote(data, numSamps, sr, midiNote) {
        const toneFreq = midiNoteToFreq(midiNote);
        const periodSec = 1/toneFreq;
        const w = 2*Math.PI/periodSec;
        for (var i = 0; i < numSamps; i++) {
            const tSec = i / sr;
            const amplitude = 0.5 * 0.05/(tSec+0.05);
            const a = 2*amplitude/Math.PI;
            const saw = a * Math.asin(Math.sin(w*tSec))
            data[i] = saw;
        }
    }

    function midiNoteToFreq(midiNote) {
        const a4hz = 440.0;
        const a4midi = 69;
        const semitones = midiNote - a4midi;
        return a4hz * Math.pow(2.0, semitones / 12.0);
    }

    function initUi() {
        // Keep min/max values below/above each other
        document.getElementById("minFret").addEventListener('change', constrain(maxFret, (a,b) => a < b), false);
        document.getElementById("maxFret").addEventListener('change', constrain(minFret, (a,b) => a > b), false);

        function constrain(dependentElement, condition) {
            return function(event) {
                const changedElement = event.target;
                const changedValue = parseInt(changedElement.value);
                const targetValue = parseInt(dependentElement.value);
                if (condition(targetValue, changedValue)) {
                    dependentElement.value = changedValue;
                }
            }
        }
    }

    function isBrowserSupported() {
        return (typeof AudioContext == "function"
            && typeof Array.from == "function"
            && typeof history.replaceState == "function"
        );
    }

    function browserMessage() {
        if (probablyHuman()) {
            errorDiv.innerText = "Your browser is not supported";
        }
        // else keep the page clean for the bot.
    }

    function watchErrors() {
        const errorDiv = document.getElementById("error-message");
        if (probablyHuman()) {
            window.addEventListener('error', function(event) { 
                errorDiv.innerText = 
                    event.message +
                    "\n(Line " + event.lineno +")";
            });
        }
        return errorDiv;
    }

    function probablyHuman() {
        return !/bot|crawl|spider/i.test(navigator.userAgent);
    }

})();