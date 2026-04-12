const form = document.getElementById("tts-form");
const fileInput = document.getElementById("file-input");
const titleInput = document.getElementById("title-input");
const textInput = document.getElementById("text-input");
const clearButton = document.getElementById("clear-button");
const dropzone = document.getElementById("dropzone");
const selectedFile = document.getElementById("selected-file");
const voiceSelect = document.getElementById("voice-select");
const voiceDescription = document.getElementById("voice-description");
const jobList = document.getElementById("job-list");
const jobCount = document.getElementById("job-count");

const audioElement = document.getElementById("audio-element");
const playButton = document.getElementById("play-button");
const pauseButton = document.getElementById("pause-button");
const backButton = document.getElementById("back-button");
const forwardButton = document.getElementById("forward-button");
const timeline = document.getElementById("timeline");
const currentTimeEl = document.getElementById("current-time");
const durationTimeEl = document.getElementById("duration-time");
const trackTitle = document.getElementById("track-title");
const trackVoice = document.getElementById("track-voice");
const playerSubtitle = document.getElementById("player-subtitle");
const downloadLink = document.getElementById("download-link");
const transcriptViewer = document.getElementById("transcript-viewer");
const readerMode = document.getElementById("reader-mode");

let jobs = [];
let selectedJobId = null;
let availableVoices = [];
let transcriptData = null;
let activeWordIndex = -1;
let loadedTranscriptJobId = null;

function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) {
    return "0:00";
  }
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remaining = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function updateSelectedFileLabel() {
  const file = fileInput.files[0];
  selectedFile.textContent = file ? file.name : "No file selected";
  titleInput.disabled = Boolean(file);
}

function renderVoices(voiceItems) {
  availableVoices = voiceItems;
  voiceSelect.innerHTML = "";
  voiceItems.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.id;
    option.textContent = `${voice.label} • ${voice.provider === "edge" ? "Premium" : "Offline"}`;
    voiceSelect.appendChild(option);
  });
  updateVoiceDescription();
}

function updateVoiceDescription() {
  const current = availableVoices.find((voice) => voice.id === voiceSelect.value) || availableVoices[0];
  if (!current) {
    return;
  }
  const providerLabel = current.provider === "edge" ? "Premium online neural voice" : "Offline local voice";
  voiceDescription.textContent = `${providerLabel} • ${current.description}`;
}

function statusLabel(job) {
  if (job.state === "processing") {
    return `Processing ${Math.round(job.progress * 100)}%`;
  }
  if (job.state === "completed") {
    return "Ready";
  }
  if (job.state === "failed") {
    return "Failed";
  }
  return "Queued";
}

function renderJobs() {
  jobCount.textContent = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`;
  if (!jobs.length) {
    jobList.innerHTML = `<div class="empty-state">No tracks yet. Submit text to start building your library.</div>`;
    return;
  }

  jobList.innerHTML = "";
  jobs.forEach((job) => {
    const card = document.createElement("article");
    card.className = `job-card ${job.id === selectedJobId ? "is-selected" : ""}`;
    const progressPercent = Math.max(3, Math.round(job.progress * 100));
    const canPlay = job.state === "completed";
    card.innerHTML = `
      <div class="job-topline">
        <div>
          <h3 class="job-title">${job.title}</h3>
          <p class="job-meta">${job.source_type} • ${job.voice_label} • ${job.text_length.toLocaleString()} characters</p>
        </div>
        <span class="status-pill status-${job.state}">${statusLabel(job)}</span>
      </div>
      <div class="job-progress" aria-hidden="true">
        <span style="width:${progressPercent}%"></span>
      </div>
      <p class="job-meta">Chunks ${job.completed_chunks}/${job.total_chunks || "?"}</p>
      <p class="job-preview">${job.error || job.preview}</p>
      <div class="job-actions">
        <span class="job-meta">${job.duration_seconds ? `${formatTime(job.duration_seconds)} long` : "Waiting for audio"}</span>
        <button type="button" data-job-id="${job.id}" ${canPlay ? "" : "disabled"}>${job.id === selectedJobId ? "Selected" : "Listen"}</button>
      </div>
    `;
    const button = card.querySelector("button");
    if (button) {
      button.addEventListener("click", () => selectJob(job.id));
    }
    jobList.appendChild(card);
  });
}

function renderTranscript(data) {
  transcriptData = data;
  activeWordIndex = -1;
  transcriptViewer.innerHTML = "";

  if (!data || !data.text || !data.words || !data.words.length) {
    transcriptViewer.innerHTML = `<p class="transcript-empty">Transcript timing is not available for this track.</p>`;
    readerMode.textContent = "No transcript timing available";
    return;
  }

  readerMode.textContent = data.timing_mode === "exact"
    ? "Word timing from the speech engine"
    : "Estimated word timing for offline voice";

  let cursor = 0;
  data.words.forEach((word, index) => {
    if (cursor < word.char_start) {
      transcriptViewer.append(document.createTextNode(data.text.slice(cursor, word.char_start)));
    }
    const span = document.createElement("span");
    span.className = "transcript-word";
    span.dataset.wordIndex = String(index);
    span.textContent = data.text.slice(word.char_start, word.char_end);
    transcriptViewer.append(span);
    cursor = word.char_end;
  });

  if (cursor < data.text.length) {
    transcriptViewer.append(document.createTextNode(data.text.slice(cursor)));
  }
}

function setActiveWord(index) {
  if (!transcriptData || index === activeWordIndex) {
    return;
  }

  const previous = transcriptViewer.querySelector(".transcript-word.is-active");
  if (previous) {
    previous.classList.remove("is-active");
  }

  activeWordIndex = index;
  if (index < 0) {
    return;
  }

  const next = transcriptViewer.querySelector(`[data-word-index="${index}"]`);
  if (!next) {
    return;
  }
  next.classList.add("is-active");
  next.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
}

function updateTranscriptForCurrentTime(currentTime) {
  if (!transcriptData || !transcriptData.words || !transcriptData.words.length) {
    return;
  }

  let foundIndex = -1;
  for (let index = 0; index < transcriptData.words.length; index += 1) {
    const word = transcriptData.words[index];
    if (currentTime >= word.start_time && currentTime < word.end_time) {
      foundIndex = index;
      break;
    }
  }

  if (foundIndex === -1 && currentTime >= transcriptData.words[transcriptData.words.length - 1].end_time) {
    foundIndex = transcriptData.words.length - 1;
  }

  setActiveWord(foundIndex);
}

async function loadTranscript(job) {
  transcriptData = null;
  activeWordIndex = -1;
  if (!job || !job.transcript_url) {
    loadedTranscriptJobId = null;
    transcriptViewer.innerHTML = `<p class="transcript-empty">Pick a finished track to follow the spoken text word by word.</p>`;
    readerMode.textContent = "Waiting for a completed track";
    return;
  }
  if (loadedTranscriptJobId === job.id) {
    return;
  }
  const response = await fetch(job.transcript_url);
  if (!response.ok) {
    loadedTranscriptJobId = null;
    transcriptViewer.innerHTML = `<p class="transcript-empty">Transcript timing is not available for this track.</p>`;
    readerMode.textContent = "Transcript unavailable";
    return;
  }
  const data = await response.json();
  loadedTranscriptJobId = job.id;
  renderTranscript(data);
}

function syncSelectedJob() {
  if (!selectedJobId) {
    return;
  }
  const current = jobs.find((job) => job.id === selectedJobId);
  if (!current || current.state !== "completed") {
    return;
  }
  if (audioElement.src !== new URL(current.audio_url, window.location.origin).href) {
    audioElement.src = current.audio_url;
  }
  trackTitle.textContent = current.title;
  trackVoice.textContent = `${current.voice_label} • ${current.provider === "edge" ? "premium neural" : "offline local"}`;
  playerSubtitle.textContent = `${current.text_length.toLocaleString()} characters • ${formatTime(current.duration_seconds || 0)}`;
  downloadLink.href = current.download_url;
  downloadLink.textContent = `Download ${String(current.audio_format || "").toUpperCase()}`;
  downloadLink.classList.remove("hidden");
  loadTranscript(current);
}

function selectJob(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job || job.state !== "completed") {
    return;
  }
  selectedJobId = jobId;
  audioElement.pause();
  audioElement.currentTime = 0;
  timeline.value = 0;
  currentTimeEl.textContent = "0:00";
  loadedTranscriptJobId = null;
  syncSelectedJob();
  renderJobs();
}

async function loadVoices() {
  const response = await fetch("/api/voices");
  const data = await response.json();
  renderVoices(data.voices);
}

async function loadJobs() {
  const response = await fetch("/api/jobs");
  const data = await response.json();
  jobs = data.jobs;

  if (!selectedJobId) {
    const newestCompleted = jobs.find((job) => job.state === "completed");
    if (newestCompleted) {
      selectedJobId = newestCompleted.id;
    }
  }

  syncSelectedJob();
  renderJobs();
}

async function submitJob(event) {
  event.preventDefault();

  const payload = new FormData();
  payload.append("voice", voiceSelect.value);
  payload.append("title", titleInput.value);
  payload.append("text", textInput.value);
  if (fileInput.files[0]) {
    payload.append("file", fileInput.files[0]);
  }

  const response = await fetch("/api/jobs", {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.detail || "Unable to create TTS job.");
    return;
  }

  titleInput.value = "";
  textInput.value = "";
  fileInput.value = "";
  updateSelectedFileLabel();
  await loadJobs();
}

function clearForm() {
  titleInput.value = "";
  textInput.value = "";
  fileInput.value = "";
  updateSelectedFileLabel();
}

function handleDrop(event) {
  event.preventDefault();
  dropzone.classList.remove("drag-active");
  const [file] = event.dataTransfer.files;
  if (!file) {
    return;
  }
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  updateSelectedFileLabel();
}

playButton.addEventListener("click", async () => {
  if (!audioElement.src) {
    return;
  }
  await audioElement.play();
});

pauseButton.addEventListener("click", () => {
  audioElement.pause();
});

backButton.addEventListener("click", () => {
  audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
});

forwardButton.addEventListener("click", () => {
  audioElement.currentTime = Math.min(audioElement.duration || 0, audioElement.currentTime + 5);
});

timeline.addEventListener("input", () => {
  if (!audioElement.duration) {
    return;
  }
  audioElement.currentTime = (Number(timeline.value) / 100) * audioElement.duration;
});

audioElement.addEventListener("timeupdate", () => {
  currentTimeEl.textContent = formatTime(audioElement.currentTime);
  durationTimeEl.textContent = formatTime(audioElement.duration);
  if (audioElement.duration) {
    timeline.value = ((audioElement.currentTime / audioElement.duration) * 100).toFixed(1);
  } else {
    timeline.value = 0;
  }
  updateTranscriptForCurrentTime(audioElement.currentTime);
});

audioElement.addEventListener("loadedmetadata", () => {
  durationTimeEl.textContent = formatTime(audioElement.duration);
  updateTranscriptForCurrentTime(audioElement.currentTime);
});

audioElement.addEventListener("seeked", () => {
  updateTranscriptForCurrentTime(audioElement.currentTime);
});

fileInput.addEventListener("change", updateSelectedFileLabel);
voiceSelect.addEventListener("change", updateVoiceDescription);
form.addEventListener("submit", submitJob);
clearButton.addEventListener("click", clearForm);

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("drag-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === "dragleave") {
      dropzone.classList.remove("drag-active");
    }
  });
});

dropzone.addEventListener("drop", handleDrop);

async function init() {
  await loadVoices();
  updateSelectedFileLabel();
  await loadJobs();
  setInterval(loadJobs, 1500);
}

init();
