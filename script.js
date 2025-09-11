let currentQuestion = 1;
const totalQuestions = 5;

// État global audio (déverrouillé après interaction)
let audioEnabled = false;

// Compteurs de points
let scores = {
  conscience: 0,
  indifference: 0,
  reflexion: 0
};

/**
 * Utilitaires
 */
function $(sel) { return document.querySelector(sel); }

/**
 * Affiche un écran par son ID avec un fondu (CSS .active)
 */
function showScreen(id) {
  document.querySelectorAll("#intro-screen, #video-screen, #mic-screen, #score-screen")
    .forEach(el => {
      el.classList.remove("active");
      el.style.display = "none";
    });

  const screen = document.getElementById(id);
  screen.style.display = "flex";
  // petit délai pour activer le fade
  setTimeout(() => screen.classList.add("active"), 50);
}

/**
 * Lecture fluide d’une vidéo avec fondu
 * - respecte l'état audioEnabled
 * - relance play() après oncanplay pour fiabiliser sur iOS
 */
function playVideoSmooth(videoEl, src, callback) {
  if (!videoEl) return;

  // Diminuer l’opacité avant changement
  videoEl.classList.add("fade-out");

  // Nettoyer anciens handlers
  videoEl.oncanplay = null;
  videoEl.onended = null;
  videoEl.onerror = null;

  setTimeout(() => {
    videoEl.src = src;
    // aligne le mute avec l'état global
    videoEl.muted = !audioEnabled;

    // playsinline pour iOS
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("webkit-playsinline", "");

    // Charger + tenter lecture (si interaction déjà faite, le son passera)
    const tryPlay = () => {
      const p = videoEl.play();
      if (p && typeof p.then === "function") {
        p.catch(err => {
          console.warn("Lecture bloquée (autoplay ?)", err);
        });
      }
    };

    videoEl.load();
    tryPlay();

    // Quand la vidéo est prête → fondu d’entrée + re-play pour fiabiliser
    videoEl.oncanplay = () => {
      videoEl.classList.remove("fade-out");
      tryPlay();
    };

    if (callback) {
      videoEl.onended = callback;
    }

    videoEl.onerror = (e) => {
      console.error("Erreur de lecture vidéo :", e);
      // En cas d'erreur vidéo, enchaîne quand même pour ne pas bloquer le flow
      if (callback) callback();
    };
  }, 300);
}

/**
 * Lancement de l'expérience
 * - Déverrouille l'audio via ce 1er clic utilisateur
 */
function startExperience() {
  console.log("Intro lancée");

  const video = document.getElementById('videoPlayer');

  // Le clic sur "Commencer" est un vrai geste utilisateur → on peut activer le son
  enableAudio();

  showScreen("video-screen");
  playVideoSmooth(video, "videos/intro.mp4", () => {
    console.log("Intro terminée");
    poserQuestion(currentQuestion);
  });
}

/**
 * Active l'audio et relance la vidéo courante si besoin
 */
function enableAudio() {
  const video = document.getElementById('videoPlayer');
  audioEnabled = true;
  if (video) {
    video.muted = false;
    const p = video.play();
    if (p && typeof p.then === "function") {
      p.catch(err => {
        console.warn("Lecture avec son refusée, sera retentée après prochaine interaction.", err);
      });
    }
  }
}

/**
 * Pose une question (lecture vidéo question)
 */
function poserQuestion(num) {
  console.log(`Question ${num} posée`);
  const video = document.getElementById('videoPlayer');
  const subtitle = document.getElementById('subtitle');
  subtitle.textContent = '';

  showScreen("video-screen");

  playVideoSmooth(video, `videos/q${num}_question.mp4`, () => {
    console.log("Question vidéo terminée → affichage écran micro");

    // Afficher l'écran micro et lancer la reco
    showScreen("mic-screen");
    setTimeout(() => startListening(num), 400);
  });
}

/**
 * Démarrage de la reconnaissance vocale
 * - Vérifie compatibilité
 * - Empêche double "silence" après un vrai résultat
 */
function startListening(numQuestion) {
  console.log("🎙️ En attente de réponse vocale...");

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    console.log("❌ Reconnaissance vocale non supportée par ce navigateur.");
    afficherReaction(numQuestion, "silence");
    return;
  }

  const reco = new SpeechRec();
  reco.lang = "fr-FR";
  // On veut une seule phrase courte
  reco.continuous = false;
  reco.interimResults = false;

  let handled = false;    // si on a déjà déclenché une réaction
  let timeoutId = null;   // sécurité

  reco.onresult = (event) => {
    if (handled) return;
    handled = true;

    const rep = (event.results?.[0]?.[0]?.transcript || "").toLowerCase();
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

    // Nettoyage
    clearTimeout(timeoutId);
    try { reco.stop(); } catch {}
  };

  reco.onerror = (err) => {
    if (handled) return;
    console.log("❌ Erreur reco vocale :", err);
    handled = true;
    clearTimeout(timeoutId);
    afficherReaction(numQuestion, "silence");
    try { reco.stop(); } catch {}
  };

  reco.onend = () => {
    // Ne pas écraser une réponse déjà traitée
    if (!handled) {
      console.log("ℹ️ Fin sans détection → silence");
      handled = true;
      clearTimeout(timeoutId);
      afficherReaction(numQuestion, "silence");
    }
  };

  // sécurité : arrêter au bout de 7s si rien capté
  timeoutId = setTimeout(() => {
    if (!handled) {
      try { reco.stop(); } catch {}
      // onend se chargera d'appeler "silence"
    }
  }, 10000);

  try {
    reco.start();
  } catch (e) {
    console.warn("Impossible de démarrer la reco :", e);
    clearTimeout(timeoutId);
    afficherReaction(numQuestion, "silence");
  }
}

/**
 * Affiche la réaction du totem
 */
function afficherReaction(num, type) {
  console.log(`🎭 Réaction Q${num} : ${type}`);
  const video = document.getElementById('videoPlayer');
  const subtitle = document.getElementById('subtitle');

  const reponses = {
    1: {
      oui: { msg: "Chaque année, 8 millions de tonnes de plastique polluent les océans.", cat: "indifference" },
      non: { msg: "Tes efforts contribuent à préserver la biodiversité.", cat: "conscience" },
      peutetre: { msg: "La pollution invisible existe, comme les microplastiques.", cat: "reflexion" },
      silence: { msg: "Prendre conscience est la première étape du changement.", cat: "reflexion" }
    },
    2: {
      oui: { msg: "Ramasser un déchet empêche des années de pollution.", cat: "conscience" },
      non: { msg: "Ignorer contribue à l’accumulation de déchets.", cat: "indifference" },
      peutetre: { msg: "L’hésitation montre qu’une habitude reste à prendre.", cat: "reflexion" },
      silence: { msg: "Le doute peut cacher un manque d’information.", cat: "reflexion" }
    },
    3: {
      oui: { msg: "Une douche de 10 min consomme jusqu’à 150 litres d’eau.", cat: "indifference" },
      non: { msg: "Tu économises l’eau, ressource précieuse.", cat: "conscience" },
      peutetre: { msg: "Réfléchir à sa consommation d’eau est essentiel.", cat: "reflexion" },
      silence: { msg: "Chaque geste compte pour préserver l’eau.", cat: "reflexion" }
    },
    4: {
      oui: { msg: "Laisser la lumière gaspille de l’énergie et émet du CO2.", cat: "indifference" },
      non: { msg: "Tu réduis ton empreinte carbone.", cat: "conscience" },
      peutetre: { msg: "Prendre conscience des petits gestes change tout.", cat: "reflexion" },
      silence: { msg: "Sais-tu vraiment ton impact énergétique ?", cat: "reflexion" }
    },
    5: {
      oui: { msg: "La défense active de la nature influence la société.", cat: "conscience" },
      non: { msg: "Se taire, c’est laisser la destruction continuer.", cat: "indifference" },
      peutetre: { msg: "Dépasser l’hésitation est essentiel pour agir.", cat: "reflexion" },
      silence: { msg: "Ton silence parle déjà…", cat: "reflexion" }
    }
  };

  const data = reponses[num][type];
  // Sécurité si une clé vidéo manque
  if (!data) {
    console.warn("Type de réaction inconnu → silence");
    return afficherReaction(num, "silence");
  }

  subtitle.textContent = data.msg;

  // Ajout des points
  scores[data.cat]++;

  // Basculer à l'écran vidéo pour montrer la réaction
  showScreen("video-screen");

  const clip = `videos/q${num}_${type}.mp4`;

  if (num < totalQuestions) {
    playVideoSmooth(video, clip, () => {
      currentQuestion++;
      poserQuestion(currentQuestion);
    });
  } else {
    // Dernière réaction puis fin
    playVideoSmooth(video, clip, () => {
      finExperience();
    });
  }
}

/**
 * Fin de l'expérience → score final
 */
function finExperience() {
  console.log("✨ Fin de l'expérience !");
  showScreen("score-screen");

  // Déterminer la fin en fonction du score
  let finalMsg = "";
  if (scores.conscience > scores.indifference && scores.conscience > scores.reflexion) {
    finalMsg = "🌱 FIN 1 : L'ÉVEIL<br>Tu marches déjà dans la bonne direction.";
  } else if (scores.indifference > scores.conscience && scores.indifference > scores.reflexion) {
    finalMsg = "🔥 FIN 2 : LA TEMPÊTE<br>Réveille-toi, avant qu'il ne soit trop tard.";
  } else {
    finalMsg = "🌊 FIN 3 : LA QUÊTE<br>Ton doute est déjà une forme de sagesse.";
  }

  document.getElementById('score-message').innerHTML = finalMsg;

  // Mettre à jour le tableau
  document.getElementById('score-conscience').textContent = scores.conscience;
  document.getElementById('score-indifference').textContent = scores.indifference;
  document.getElementById('score-reflexion').textContent = scores.reflexion;
}

