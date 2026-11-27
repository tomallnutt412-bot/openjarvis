# Cassius Groundworks Ltd: website

A single-page static site (HTML + CSS + a little vanilla JS). No build step and no framework.
Upload the whole `cassius-groundworks/` folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, or a cPanel host).

```
index.html        page, SEO tags, LocalBusiness schema
styles.css        all styling (palette tokens at the top)
script.js         header on scroll, reveal, gallery lightbox, quote form
assets/img/       job photos as WebP (800px + 1600px each)
assets/video/     hero.mp4 (2 MB, muted loop, logo cropped) + poster image
```

Preview locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

## Before going live
1. **Form.** Create a free form at [formspree.io](https://formspree.io) using cassius.dig@gmail.com. Copy the form ID and replace `YOUR_FORM_ID` in `index.html`. Until you do, the form opens the visitor's email app with their details already filled in, so no enquiries are lost.
   Alternatives: Netlify Forms (add `data-netlify="true"` if you host on Netlify) or Web3Forms. All three have free tiers.
2. **Domain.** Replace `https://www.cassiusgroundworks.co.uk/` (canonical, og:image, JSON-LD) with the real domain.
3. **Google Business Profile.** Set one up with the same name, phone and service area. For local search it matters more than anything on the page.
4. **Testimonial.** There's a commented placeholder in the "Why" section. Add only real reviews.

## Copy by section
| Section | Headline | Supporting copy |
|---|---|---|
| Hero | Groundworks done properly, from the first dig. | Footings, drainage, driveways and gardens across Poole & Bournemouth. Jesse turns up with his own mini digger, 1 ton dumper, hydraulic breaker and tipper, so your job starts on time and finishes clean. CTAs: **Call Jesse · 07787 555963** / Get a free quote |
| Services | All aspects of groundworks, under one roof | From the first trench to the final roll of turf. One local team and one point of contact, so there's no chasing different trades. Includes 4 feature cards and the full list of 11 services. |
| Why | A local operator who brings the kit and turns up. | Own machinery · Local to Poole & Bournemouth · Day work or price work · Reliable & tidy, plus a 3-step "how it works" |
| Gallery | Jobs across Poole & Bournemouth | 10 photos with a tap-to-enlarge lightbox |
| Contact | Talk to Jesse about your job | Large phone and email links, the areas covered, and a 4-field quote form |

## SEO
- **Title:** Groundworks Poole & Bournemouth | Cassius Groundworks Ltd – Man & Mini Digger
- **Meta description:** Local groundworks in Poole & Bournemouth. Jesse brings his own mini digger, 1 ton dumper, breaker & tipper for footings, drainage, driveways, patios, garden clearance & turfing. Day work or price work. Call 07787 555963.
- **Keywords used naturally in the copy:** groundworks Poole, groundworks Bournemouth, mini digger hire with operator Poole, man and digger Bournemouth, footings contractor Dorset, drainage Poole, driveway groundworks Bournemouth, garden clearance and levelling Poole, shed base / garage base Bournemouth, turfing Poole, Westbourne.
- **`GeneralContractor` JSON-LD** with phone, email, Westbourne address and the towns covered.
- **Performance and accessibility:** WebP photos with `srcset`, lazy loading, a poster frame that shows before the video loads, the video paused when the visitor has reduced motion turned on, a skip link, visible focus states, labelled form fields, and 48px+ tap targets.
