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
            var currentPeriodSecs = 5;

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
                if (source) {
                    source.stop()
                }

                const notes = [60, 61, 62]
                const note = notes[Math.floor(Math.random() * notes.length)];
                console.log(note);
                source = playNote(note, context);

                timer = setTimeout(nextNote, currentPeriodSecs*1000);
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