import type { CropStrategy } from "@/lib/types";

export interface Story {
  slug: string;
  title: string;
  dek: string;
  eyebrow: string;
  date: string;
  hero: { id: string; alt: string; crop: CropStrategy };
  body: string[];
  images: { id: string; alt: string; crop: CropStrategy; caption?: string }[];
  relatedCollection: string;
}

export const STORIES: Story[] = [
  {
    slug: "the-weight-of-a-good-coat",
    title: "The Weight of a Good Coat",
    dek: "On double-faced cashmere, and why the best coats are the ones you forget you are wearing.",
    eyebrow: "Notes from the atelier",
    date: "2026-09-02",
    hero: { id: "photo-1544022613-e87ca75a784a", alt: "Woman in a camel wool coat against a stone wall", crop: "faces,entropy" },
    body: [
      "A coat should not announce itself. It should sit on the shoulder like a hand, fall from the collar in one unbroken line, and be forgotten the moment it is buttoned. That sounds simple. It is the hardest thing we make.",
      "Double-faced cashmere is two fabrics woven as one, then split at the edge and hand-stitched back together so the coat needs no lining. The result weighs less than a wool overcoat and holds more warmth. Every seam is worked twice, once from each face, by a single tailor.",
      "We cut our coats a half-size generous through the body. Not oversized; unhurried. A coat you can wear over a jacket in January and over a T-shirt in October, without either looking like a compromise.",
      "The camel coat in this story is the Ines, which we have made every season since the beginning. We change the buttons occasionally. We do not change the cut.",
    ],
    images: [
      { id: "photo-1520006403909-838d6b92c22e", alt: "Detail of a wool coat lapel", crop: "faces,entropy", caption: "Hand-padded lapels roll rather than fold." },
      { id: "photo-1558171813-4c088753af8f", alt: "Coat on a wooden hanger", crop: "entropy", caption: "Stored on a wide, shaped hanger." },
    ],
    relatedCollection: "women-coats",
  },
  {
    slug: "notes-on-camel",
    title: "Notes on Camel",
    dek: "A colour that flatters almost everyone, and how to wear it if you are the exception.",
    eyebrow: "Colour",
    date: "2026-08-19",
    hero: { id: "photo-1529139574466-a303027c1d8b", alt: "Woman in an ivory knit with a camel scarf", crop: "faces,entropy" },
    body: [
      "Camel is the closest thing fashion has to a universal neutral. It is warm without being loud, deep without being heavy, and it photographs like money. But it is not universal, and the people it does not suit tend to know it without knowing why.",
      "The reason is undertone. True camel sits on the warm side of the wheel, between honey and tobacco. Against warm skin it glows. Against cool skin, particularly cool skin with high contrast, it can flatten. This is not a flaw in the person or the colour. It is a mismatch.",
      "If camel flattens you, look at our Stone and Dove Grey pieces, which carry the same softness in a cooler key. If it glows on you, wear it head to toe and thank us later.",
      "This is the thinking behind the colour analysis you will find on every product page. Upload a photo, or answer six questions, and we will tell you where a piece sits against your palette. It runs entirely in your browser. Your photo never leaves your device.",
    ],
    images: [
      { id: "photo-1524250502761-1ac6f2e30d43", alt: "Woman in camel coat in soft light", crop: "faces,entropy" },
      { id: "photo-1475180098004-ca77a66827be", alt: "Folded knitwear in warm neutrals", crop: "entropy", caption: "Camel, oat and stone in the same knit." },
    ],
    relatedCollection: "women-knitwear",
  },
  {
    slug: "in-the-atelier-hand-finished-seams",
    title: "In the Atelier: Hand-Finished Seams",
    dek: "Thirty people, one workshop, and a leather tote that takes eleven hours to make.",
    eyebrow: "Craft",
    date: "2026-07-28",
    hero: { id: "photo-1445205170230-053b83016050", alt: "Garments hanging on a rail in an atelier", crop: "entropy" },
    body: [
      "Our leather goods are made in a workshop outside Florence that employs thirty people. Each bag is cut, stitched and finished by one of them, start to end. Their initials are stamped inside the pocket.",
      "Saddle stitching uses two needles and one thread, passing through the same hole from opposite sides. If one stitch breaks, the seam holds. A machine cannot do it. Neither, for the first year, can most apprentices.",
      "Edge paint is applied in five thin coats, each one sanded back before the next. It is what gives a raw edge the look of a single, dense line. It is also what most factories skip.",
      "We are often asked why our bags cost what they cost. This is why.",
    ],
    images: [
      { id: "photo-1584917865442-de89df76afd3", alt: "Leather handbag on a table", crop: "entropy", caption: "Full-grain calf, vegetable tanned." },
      { id: "photo-1558769132-cb1aea458c5e", alt: "Clothing rail in a workshop", crop: "entropy" },
    ],
    relatedCollection: "leather-goods",
  },
  {
    slug: "a-season-in-colour",
    title: "A Season in Colour",
    dek: "Why we built personal colour analysis into the storefront, and how the seasonal system actually works.",
    eyebrow: "Colour analysis",
    date: "2026-09-10",
    hero: { id: "photo-1515886657613-9f3515b0c78f", alt: "Woman in a bright editorial look", crop: "faces,entropy" },
    body: [
      "Personal colour analysis began as a studio service, and in Seoul it has become something closer to a rite of passage. A consultant drapes fabric after fabric under daylight lamps until the face brightens or dulls, then names a season: Spring, Summer, Autumn or Winter, each with three sub-tones.",
      "The system rests on three measurable properties of skin. Undertone, whether the skin leans yellow or pink. Depth, how light or deep it is. And clarity, whether the features read as bright and contrasting or soft and blended. Our analysis measures the first two from a photograph, in the CIELAB colour space dermatologists use, and asks you about the third.",
      "Once we know your season, every piece in the catalogue can be scored against your palette. The score weighs warmth, depth and chroma alignment alongside the perceptual distance to your season's best colours, then says in plain words whether the piece was made for you or is one to wear with intention.",
      "None of this replaces a mirror. It is meant to make the mirror more interesting.",
    ],
    images: [
      { id: "photo-1503342217505-b0a15ec3261c", alt: "Woman in a red dress", crop: "faces,entropy", caption: "Claret: a Winter colour that Autumn can borrow." },
      { id: "photo-1509631179647-0177331693ae", alt: "Woman in a soft pastel dress", crop: "faces,entropy", caption: "Powder and blush, the Summer key." },
    ],
    relatedCollection: "new-arrivals",
  },
];

export function getStory(slug: string): Story | undefined {
  return STORIES.find((s) => s.slug === slug);
}
