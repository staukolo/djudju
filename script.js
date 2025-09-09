let currentQuestion = 1;
const totalQuestions = 4;

function startExperience() {
  console.log("Intro lancée");
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('video-screen').style.display = 'block';

  const video = document.getElementById('videoPlayer');
  video.src = 'videos/intro.mp4';
  video.muted = false;
  video.play();

  video.onended = () => {
    console.log("Intro terminée");
    poserQuestion(currentQuestion);
  };
}

function poserQuestion(num) {
  console.log(`Question ${num} posée`);
  const video = document.getElementById('videoPlayer');
  const subtitle = document.getElementById('subtitle');
  subtitle.textContent = '';

  video.src = `videos/q${num}_question.mp4`;
  video.play();

  video.onended = () => {
    console.log("Question vidéo terminée → démarrage micro");
    startListening(num);
  };
}

function startListening(numQuestion) {
  console.log("🎙️ En attente de réponse vocale...");
  const reco = new webkitSpeechRecognition();
  reco.lang = "fr-FR";
  reco.start();

  reco.onresult = (event) => {
    const rep = event.results[0][0].transcript.toLowerCase();
    console.log("🗣️ Réponse détectée :", rep);
    if (rep.includes("oui")) {
      afficherReaction(numQuestion, "oui");
    } else if (rep.includes("non")) {
      afficherReaction(numQuestion, "non");
    } else if (rep.includes("peut")) {
      afficherReaction(numQuestion, "peutetre");
    } else {
      afficherReaction(numQuestion, "silence");
    }
  };

  reco.onerror = (err) => {
    console.log("❌ Erreur reco vocale :", err);
    afficherReaction(numQuestion, "silence");
  };
}

function afficherReaction(num, type) {
  console.log(`🎭 Réaction : ${type}`);
  const video = document.getElementById('videoPlayer');
  const subtitle = document.getElementById('subtitle');

  const messages = {
    oui: "Mais TOII OUII, quand tu dis oui.",
    non: "Faut pas pleurer KOLOOOO",
    peutetre: "faut pas dire peut-être, faut dire oui ou non.",
    silence: "Mais réponds wsh!!!"
  };

  subtitle.textContent = messages[type] || "";

  video.src = `videos/q${num}_${type}.mp4`;
  video.play();

  video.onended = () => {
    currentQuestion++;
    if (currentQuestion <= totalQuestions) {
      poserQuestion(currentQuestion);
    } else {
      finExperience();
    }
  };
}

function finExperience() {
  console.log("✨ Fin de l'expérience !");
  const video = document.getElementById('videoPlayer');
  document.getElementById('subtitle').textContent = "";
  video.src = "videos/fin.mp4";
  video.play();
}
