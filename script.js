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
                console.log(options);

                if (source) {
                    source.stop()
                }

                const [noteNum, noteName, stringNum] = pickNextNote(options);
                console.log(noteName);
                document.getElementById("title").innerText = noteName;
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
        const midiC0 = 12;
        const notes = "C2D4EF1G3A5B";
        const subscripts = "₀₁₂₃₄₅₆₇₈₉";
        var inote = 0;

        function pickNextNote(options) {
            // Don't repeat last note: inc by [1,12)
            inote = (inote + randInt(1, 12)) % 12;
            const ioctave = randInt(4, 7);
            var noteStr = notes.charAt(inote);
            const sharpIndex = Number(notes.charAt(inote));
            if (!isNaN(sharpIndex)) {
                const goSharp = randInt(1, 7) > sharpIndex;
                // no need to wrap cos B/C have nothing between:
                noteStr = notes.charAt(inote + (goSharp?-1:1)) + "♭♯".charAt(goSharp);
            }
            return [
                midiC0 + ioctave*12 + inote, 
                noteStr + subscripts.charAt(ioctave), 
                0
                ];
        }

        return pickNextNote;
    }


    function randInt(min, maxExcl) {
        return Math.floor(Math.random() * (maxExcl - min) + min);
    }

    function getOptions() {
        const inputs = [...document.querySelectorAll('table input')];
        const fromForm = Object.fromEntries(inputs.map(input => [
            input.id, input.hasAttribute("checked") ? input.checked : input.value
        ]));
        const other = {
            minNote: 40, // e2
        };
        return {...fromForm, ...other};
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
        const bufferSamps = Math.round(sr * maxPeriodSecs);
        const buffer = context.createBuffer(1, bufferSamps, sr);
        writeNote(buffer.getChannelData(0), sr, midiNote);
        return buffer;
    }

    function writeNote(data, sr, midiNote) {
        // Cosine blend from sharp 1 down to zero, based on clickToneFreq.
        const toneFreq = midiNoteToFreq(midiNote);
        const periodSec = 1/toneFreq;
        const w = 2*Math.PI/periodSec;
        const clickSamps = sr * maxPeriodSecs;
        for (var i = 0; i < clickSamps; i++) {
            const tSec = i / sr;
            const amplitude = 0.05/(tSec+0.05);
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

    function readBpm() {
        const match = /bpm=(\d+)/gi.exec(document.location.search);
        return match ? Math.max(minBpm, parseInt(match[1])) : 120;
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