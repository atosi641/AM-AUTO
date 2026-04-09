# AM Auto Dealership Website

This repository contains the front-end source code for the **AM Auto** dealership website. Built dynamically with semantic HTML, Tailwind CSS, and AOS (Animate On Scroll) for a premium, lightweight, and incredibly fast user experience without the need for a heavy framework or backend.

## 🗂️ Project Structure

Below is the structured layout of the files, properly mapping out the website's architecture:

```text
AM-AUTO/
├── 📄 index.html             # Main Landing Page / Front door
├── 📄 home.html              # (Identical mirror of index.html)
├── 📄 lager.html             # Full vehicle inventory grid
├── 📄 bil-detaljer.html      # Dynamic template for single car views
├── 📄 salj-din-bil.html      # Car valuation request & contact form
├── 📄 kontakt.html           # Store hours, address, and email form
├── 📄 om-oss.html            # Dealership history and photo gallery
├── 📄 cookies-policy.html    # GDPR & Data policy compliance
│
├── 📁 css/                   
│   └── (Reserved folder for Tailwind production styling files)
│
└── 📁 images/                # Centralized asset repository
    ├── AM AUTO LOGO.jpg
    ├── logo bank.jpg
    ├── om oss 1.jpg (1-9)
    ├── bmw 520d X.avif (1-18)
    ├── xc60 X.avif
    ├── captiava X.avif
    └── ... (50+ vehicle photos)
```

## 🚀 Technologies Used
*   **HTML5**
*   **JavaScript (Vanilla)**
*   **Tailwind CSS** (via CDN currently)
*   **AOS Library** (For smooth fade-in scrolling)
*   **FormSubmit Integration** (For serverless email forwarding from HTML forms)

## 📞 How the Forms Work
Both the `salj-din-bil.html` and `kontakt.html` pages send leads directly to `Amauto.katrineholm@gmail.com` using the FormSubmit.co API without requiring a backend PHP server.
