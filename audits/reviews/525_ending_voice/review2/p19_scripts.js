// Probe 19: denouementSplit / hasWordCh / textHasWord on scripts without case below U+2E80. usage: [ER=<tree>] node p19_scripts.js
require("./h.js");
var samples = {
  "Hebrew, hero's Latin name in paragraph 1 only": "פסקה ראשונה Ammut.\n\nפסקה שנייה.\n\nפסקה שלישית.\nRECORD: Ammut learned to stay.",
  "Arabic, all Arabic": "كان يا ما كان.\n\nخرجت من الوادي.\nRECORD: أموت تعلم البقاء.",
  "Hindi, label alone + Hindi sentence": "आप घाटी से बाहर आए।\nRECORD:\nअमुत ने रुकना सीखा।",
  "Thai": "คุณเดินออกจากหุบเขา\nRECORD: Ammut learned to stay.",
  "English prose that closes on a Hebrew inscription line": "You walk out of the valley.\n\nThe stone over the door still reads:\nשלום עליכם\nRECORD: Ammut learned to stay.",
  "Korean (Hangul syllables)": "당신은 계곡을 떠났다.\nRECORD: Ammut learned to stay.",
  "Russian": "Ты вышел из долины.\nRECORD: Аммут научился оставаться.",
  "Georgian": "შენ დატოვე ხეობა.\nRECORD: Ammut learned to stay.",
  "Amharic": "አንተ ሸለቆውን ለቀቅክ።\nRECORD: Ammut learned to stay."
};
Object.keys(samples).forEach(function (k) { var r = denouementSplit(samples[k]); console.log(k + "\n   in:     " + JSON.stringify(samples[k]) + "\n   prose:  " + JSON.stringify(r.prose) + "\n   record: " + JSON.stringify(r.record)); });
console.log("hasWordCh: Hebrew " + (typeof hasWordCh === "function" ? hasWordCh("שלום") : "n/a") + ", Arabic " + (typeof hasWordCh === "function" ? hasWordCh("سلام") : "n/a") + ", Devanagari " + (typeof hasWordCh === "function" ? hasWordCh("नमस्ते") : "n/a") + ", Thai " + (typeof hasWordCh === "function" ? hasWordCh("สวัสดี") : "n/a") + ", Japanese " + (typeof hasWordCh === "function" ? hasWordCh("こんにちは") : "n/a") + ", Georgian " + (typeof hasWordCh === "function" ? hasWordCh("გამარჯობა") : "n/a"));
if (typeof textNamesPerson === "function") {
  console.log("textNamesPerson(Hebrew 'the aunt came', hero David): " + textNamesPerson("הדודה שלי באה.", "דוד") + "   (the name is a substring of another word)");
  console.log("textNamesPerson(Arabic 'Mahmoud left', hero 'Hamd'): " + textNamesPerson("محمود غادر.", "حم") );
}
