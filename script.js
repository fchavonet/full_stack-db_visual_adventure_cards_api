let allCardData = [];

const apiStatus = document.getElementById("api-status");
const partSelect = document.getElementById("part-select");
const cardSelect = document.getElementById("card-select");
const cardDetails = document.getElementById("card-details");

// Copy text to clipboard with visual feedback.
async function copyToClipboard(text, iconElement) {
  try {
    await navigator.clipboard.writeText(text);

    const originalClass = iconElement.className;
    iconElement.className = iconElement.className.replace("bi-copy", "bi-check");
    iconElement.style.color = "#0369a1";

    setTimeout(() => {
      iconElement.className = originalClass;
      iconElement.style.color = "";
    }, 2000);

  } catch (error) {
    console.error(error.message);

    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
}

// Update API status indicator with connection state and last update date.
async function updateApiStatus() {
  let isOnline = false;
  let updatedAt = "unknown";

  try {
    const response = await fetch("./api/v1/meta.json");
    const metadata = await response.json();

    isOnline = true;
    updatedAt = new Date(metadata.generated_at).toLocaleDateString("en-US");
  } catch (error) {
    console.error(error.message);
    isOnline = false;
    updatedAt = "unknown";
  }

  // Create status dot indicator.
  const pointContainer = document.createElement("span");
  pointContainer.className = "relative";

  const staticDot = document.createElement("span");
  staticDot.className = "w-2 h-2 block rounded-full";

  if (isOnline) {
    staticDot.classList.add("bg-green-500");
  } else {
    staticDot.classList.add("bg-red-500");
  }

  pointContainer.appendChild(staticDot);

  // Create animated ping effect for status dot.
  const pingDot = document.createElement("span");
  pingDot.className = "w-2 h-2 absolute top-0 left-0 rounded-full animate-ping";

  if (isOnline) {
    pingDot.classList.add("bg-green-500");
  } else {
    pingDot.classList.add("bg-red-500");
  }

  pointContainer.appendChild(pingDot);

  apiStatus.appendChild(pointContainer);

  // Display status text (ONLINE/OFFLINE).
  const statusText = document.createElement("span");
  statusText.className = "px-2 py-1 rounded";

  if (isOnline) {
    statusText.textContent = "ONLINE";
    statusText.classList.add("text-green-800", "bg-green-100");
  } else {
    statusText.textContent = "OFFLINE";
    statusText.classList.add("text-red-800", "bg-red-100");
  }

  apiStatus.appendChild(statusText);

  // Display last update date.
  const dashText = document.createTextNode("- Last update: ");

  apiStatus.appendChild(dashText);

  const dateText = document.createElement("span");
  dateText.textContent = updatedAt;

  apiStatus.appendChild(dateText);
}

// Load available parts from API metadata.
async function loadParts() {
  try {
    const response = await fetch("./api/v1/meta.json");
    const metadata = await response.json();

    for (const partNumber in metadata.parts) {
      const option = document.createElement("option");
      option.value = partNumber;
      option.textContent = "Part " + partNumber;
      partSelect.appendChild(option);
    }

    partSelect.disabled = false;
  } catch (error) {
    console.error(error.message);
  }
}

// Load cards for selected part.
async function loadCards(partNumber) {
  try {
    const response = await fetch("./api/v1/parts/" + partNumber + ".json");
    allCardData = await response.json();

    cardSelect.innerHTML = '<option value="">Choose a card</option>';

    for (const cardData of allCardData) {
      const option = document.createElement("option");
      option.value = cardData.id;
      option.textContent = cardData.number + " - " + cardData.title_jp;
      cardSelect.appendChild(option);
    }

    cardSelect.disabled = false;
  } catch (error) {
    console.error(error.message);
  }
}

// Fetch single card data by ID.
async function loadSingleCard(cardId) {
  try {
    const response = await fetch("./api/v1/cards/" + cardId + ".json");

    return await response.json();
  } catch (error) {
    console.error(error.message);
  }
}

// Display selected card details.
async function displayCardDetails(selectedCard) {
  const cardData = await loadSingleCard(selectedCard);

  cardDetails.innerHTML = "";

  const cardInfoList = document.createElement("ul");

  const cardInfo = [
    '<span class="font-semibold">Part:</span> ' + cardData.part,
    '<span class="font-semibold">Number:</span> ' + cardData.number,
    '<span class="font-semibold">Year:</span> ' + cardData.year,
    '<span class="font-semibold">Rarity:</span> ' + cardData.rarity,
    '<img class="inline" src="https://flagsapi.com/JP/flat/16.png"> ' + cardData.title_jp,
    '<img class="inline" src="https://flagsapi.com/US/flat/16.png"> ' + cardData.title_en,
    '<img class="inline" src="https://flagsapi.com/FR/flat/16.png"> ' + cardData.title_fr
  ];

  cardInfo.forEach(info => {
    const li = document.createElement("li");
    li.innerHTML = info;
    cardInfoList.appendChild(li);
  });

  cardDetails.appendChild(cardInfoList);

  const cardContainer = document.createElement("div");
  cardContainer.className = "w-59 h-86 mx-auto my-auto cursor-pointer";
  cardContainer.style.perspective = "1000px";

  const cardFlipper = document.createElement("div");
  cardFlipper.className = "w-full h-full relative transition-transform duration-700";
  cardFlipper.style.transformOrigin = "center";
  cardFlipper.style.transformStyle = "preserve-3d";

  // Front side.
  const frontSide = document.createElement("div");
  frontSide.className = "w-full h-full absolute inset-0";
  frontSide.style.backfaceVisibility = "hidden";

  const frontImg = document.createElement("img");
  frontImg.className = "w-full h-full object-cover rounded-lg";
  frontImg.src = cardData.front_image_url;
  frontImg.alt = "Card front";
  frontSide.appendChild(frontImg);

  // Back side.
  const backSide = document.createElement("div");
  backSide.className = "w-full h-full absolute inset-0";
  backSide.style.backfaceVisibility = "hidden";
  backSide.style.transform = "rotateY(-180deg)";

  const backImg = document.createElement("img");
  backImg.className = "w-full h-full object-cover rounded-lg";
  backImg.src = cardData.back_image_url;
  backImg.alt = "Card back";
  backSide.appendChild(backImg);

  cardFlipper.appendChild(frontSide);
  cardFlipper.appendChild(backSide);
  cardContainer.appendChild(cardFlipper);

  let isFlipped = false;

  cardContainer.addEventListener("click", () => {
    if (isFlipped) {
      cardFlipper.style.transform = "rotateY(0deg)";
    } else {
      cardFlipper.style.transform = "rotateY(180deg)";
    }

    isFlipped = !isFlipped;
  });

  cardDetails.appendChild(cardContainer);
}

// Handle part selection changes.
partSelect.addEventListener("change", () => {
  if (partSelect.value) {
    loadCards(partSelect.value);
    cardDetails.innerHTML = "<p>No card selected.</p>";
  } else {
    cardSelect.innerHTML = '<option value="">First, select a part</option>';
    cardSelect.disabled = true;
    cardDetails.innerHTML = "<p>No part selected.</p>";
  }
});

// Handle card selection changes.
cardSelect.addEventListener("change", () => {
  if (cardSelect.value) {
    displayCardDetails(cardSelect.value);
  } else {
    cardDetails.innerHTML = "<p>No card selected.</p>";
  }
});

// Initialize the application.
updateApiStatus()
loadParts();
