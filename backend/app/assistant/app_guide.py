"""What AgriSmart is and how to use it, for the assistant to explain the app in any language.

Keep this in step with the mobile app's screens (mobile/src/app). The assistant answers
questions about the app from this text only; it never invents buttons or features.
"""

APP_GUIDE = """\
AgriSmart is a free farming assistant for Indian farmers. It works in English, Tamil, Hindi,
Telugu, Kannada, Marathi, Bengali, Gujarati, Malayalam, Punjabi and Odia. Farmers can ask by
voice or by typing, in the app, on the web, or by calling from any phone (even a button phone).

Home screen: a large microphone button. Tap it and speak; AgriSmart answers aloud in the same
language. "Conversation mode" keeps listening after each answer. "Type your question" opens a
chat. Below are quick-help tiles for every feature, the weather for today, and an alerts bell.

Features (each is a tile on the home screen, and each can also be asked by voice):
- Weather: today's weather and the next 7 days for the farmer's village, with farm advice such
  as "avoid spraying before rain". Live data from Open-Meteo.
- Market prices: today's mandi prices for a crop (common price and the range, in rupees per
  quintal) from the government Agmarknet service. Choose a crop to see nearby mandis.
- Which crop should I grow: recommends crops for the field using its soil test (N, P, K, pH)
  and local weather. Needs a farm with a soil test.
- Plant doctor: take a clear photo of one affected leaf in daylight; AgriSmart names the likely
  disease and explains cause, symptoms, treatment, prevention and safety.
- Pest check: take a photo of the insect or the damaged part to identify the pest and how to
  control it.
- Government schemes: lists schemes such as PM-KISAN, crop insurance and Kisan Credit Card,
  shows which the farmer is likely eligible for, the benefits, who can apply, how to apply and
  the official website.
- Farm calendar: after adding a crop with its sowing date, shows farm tasks (fertilizer,
  irrigation, spraying, harvest) and reminds the farmer the day before.
- Yield estimate: expected harvest in quintals per acre for a crop and area.
- Profit calculator: enter area, expected yield, expected price and costs to see profit,
  break-even price and what happens if prices or yield change.
- Alerts: weather warnings, big price changes for the farmer's crops, disease outbreaks nearby,
  new government schemes and farm-task reminders. Smartphones get notifications; button phones
  get a voice call or SMS.

My farm tab: add a farm (name, area in acres, soil type, irrigation), add a soil test by copying
the numbers from the Soil Health Card, and add crops with their sowing date.
Profile tab: change the language (the whole app switches at once), choose a female or male
voice and the speaking speed (slow, normal, fast), and pick which alerts to receive.

Getting started: choose a language, sign in with a mobile number and the code sent by SMS,
enter name and village, then add a farm and a soil test for the best crop advice.

Common questions:
- Cost: AgriSmart is free for farmers. Calls and SMS use the farmer's normal phone balance.
- Language: any of the 11 languages; the farmer can speak in a different language than the one
  set, and AgriSmart answers in the language spoken. Change it any time in Profile.
- Voice: tap the microphone, speak, and stop talking; AgriSmart notices the silence and
  answers aloud. Speak close to the phone in a quiet place. If voice does not work, check that
  the microphone is allowed for the app, or type the question instead.
- Male or female voice and speed: Profile, Voice; press "Listen" to hear a sample.
- Where prices come from: the government Agmarknet service, as reported by mandis; prices
  change daily and differ by mandi and quality, so check with the mandi before selling.
- Weather: live forecast for the farmer's village location; set the village in Profile.
- Plant doctor accuracy: it identifies common diseases from a clear photo of one leaf, and says
  how sure it is. If unsure it asks for a better photo. For serious problems or before buying
  chemicals, confirm with the local agriculture officer or Kisan Call Centre 1800-180-1551.
- Crop advice needs the soil test numbers (N, P, K, pH) from the Soil Health Card; without a
  soil test it can only use the season and weather.
- Schemes: eligibility shown is a guide from the farmer's details; the final decision is made
  by the government office. Each scheme has a link to its official website.
- Alerts: choose which alerts to receive in Profile. Alerts also appear in the bell on Home.
- Privacy: the farmer's phone number, location and farm details are used only to give advice
  and alerts, and are not shown to other farmers.
- Button phones: farmers without a smartphone can call AgriSmart's phone number and ask by
  voice; they get answers and alerts by voice call or SMS.
- Internet: the app needs internet for live weather, prices and answers. If a request is slow
  it says so; try again on a better signal.
"""
