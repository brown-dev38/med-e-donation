"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";
import FundNews from "./components/fund-news";

type IconName = "heart" | "arrow" | "graduate" | "shield" | "document" | "clock" | "user" | "upload" | "check" | "mail" | "phone" | "pin" | "leaf";

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    arrow: <path d="M4 12h16M14 6l6 6-6 6" />,
    graduate: <path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v6c4 3 8 3 12 0v-6M22 9v7" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    document: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
    check: <path d="m5 12 4 4L19 6" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    phone: <path d="m8 3 2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v3a2 2 0 0 1-2 2C10 21 3 14 3 5a2 2 0 0 1 2-2h3Z" />,
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    leaf: <path d="M20 3C7 2 2 8 6 16c8 4 14-1 14-13ZM4 21 16 9" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Brand() {
  return <a href="#main" className="brand" aria-label="MED UP e-Donation หน้าแรก"><Image src="/images/LogoMed2.png" alt="ตราคณะแพทยศาสตร์ มหาวิทยาลัยพะเยา" width={46} height={46} className="brand-emblem" /><span className="brand-copy"><span className="brand-title">MED UP <span>e-Donation</span></span><span className="brand-subtitle">คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา</span></span></a>;
}

const slides = [
  { image: "/images/scholarship.jpeg", alt: "ภาพประกอบนิสิตแพทย์ในอาคารเรียน", label: "หนึ่งโอกาส สู่อนาคตของการดูแล", detail: "ร่วมเป็นส่วนหนึ่งของเส้นทางการเป็นแพทย์" },
  { image: "/images/learning.jpeg", alt: "ภาพประกอบการเรียนรู้ทักษะทางคลินิกกับอาจารย์แพทย์", label: "เติมโอกาสให้ทุกการเรียนรู้", detail: "สนับสนุนการเติบโตของนิสิตแพทย์" },
  { image: "/images/community.jpeg", alt: "ภาพประกอบการดูแลสุขภาพของผู้คนในชุมชน", label: "จากการให้ สู่การดูแลสังคม", detail: "ส่งต่อความตั้งใจดีไปถึงผู้คนอีกมากมาย" },
];

const benefits: { icon: IconName; title: string; detail: string }[] = [
  { icon: "graduate", title: "ให้ตรงกับความตั้งใจ", detail: "เลือกสนับสนุนทุนได้ 2 รูปแบบ" },
  { icon: "heart", title: "เริ่มต้นได้ด้วยน้ำใจ", detail: "ไม่ต้องสมัครสมาชิก" },
  { icon: "document", title: "ใบอนุโมทนาบัตร PDF", detail: "จัดส่งทางอีเมลหลังตรวจสอบ" },
  { icon: "clock", title: "นำส่งข้อมูล e-Donation", detail: "ภายใน 2 สัปดาห์หลังตรวจสอบ" },
];

const steps: { icon: IconName; title: string; detail: string }[] = [
  { icon: "heart", title: "เลือกทุนที่อยากสนับสนุน", detail: "เลือกสมทบกองทุนส่วนกลาง หรือระบุชื่อนิสิตที่ต้องการมอบทุน" },
  { icon: "user", title: "กรอกข้อมูลผู้บริจาค", detail: "เตรียมชื่อ ข้อมูลผู้เสียภาษี และอีเมลสำหรับรับใบอนุโมทนาบัตร" },
  { icon: "upload", title: "โอนเงินและแนบสลิป", detail: "โอนเงินตามข้อมูลบัญชีในแบบฟอร์ม พร้อมแนบหลักฐานการโอน" },
  { icon: "document", title: "รับใบอนุโมทนาบัตร", detail: "เจ้าหน้าที่ตรวจสอบและส่งใบอนุโมทนาบัตร PDF ให้ทางอีเมล" },
];

const faqs = [
  { question: "ต้องสมัครสมาชิกก่อนบริจาคหรือไม่?", answer: "ไม่ต้องสมัครสมาชิก ผู้บริจาคสามารถเลือกวัตถุประสงค์ กรอกข้อมูลผู้บริจาค และแนบหลักฐานการโอนเงินผ่านแบบฟอร์มบริจาคได้โดยตรง" },
  { question: "สามารถระบุชื่อนิสิตที่ต้องการมอบทุนได้ไหม?", answer: "ได้ โดยเลือกทุนการศึกษาแบบระบุผู้รับทุน และเตรียมชื่อ–นามสกุลของนิสิตแพทย์ที่ต้องการสนับสนุน พร้อมรหัสนิสิตหากทราบ" },
  { question: "จะได้รับใบอนุโมทนาบัตรอย่างไร?", answer: "หลังเจ้าหน้าที่ตรวจสอบและอนุมัติหลักฐานการโอนเงิน ใบอนุโมทนาบัตรอิเล็กทรอนิกส์รูปแบบ PDF จะถูกจัดส่งไปยังอีเมลที่ผู้บริจาคระบุไว้ กรุณาตรวจสอบความถูกต้องของอีเมลก่อนยืนยันรายการ" },
  { question: "การนำส่งข้อมูล e-Donation ใช้เวลานานเท่าไร?", answer: "เจ้าหน้าที่จะดำเนินการนำส่งข้อมูล e-Donation ภายใน 2 สัปดาห์หลังตรวจสอบยอดโอน หากพ้นกำหนดแล้วยังไม่พบข้อมูล หรือต้องการแก้ไขข้อมูลผู้บริจาค กรุณาติดต่อศูนย์ประสานงานกองทุน" },
];

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentSlide = slides[slide];

  return (
    <>
      <a className="skip-link" href="#main">ข้ามไปยังเนื้อหา</a>
      <div className="announcement"><span><Icon name="leaf" size={15} /> ทุกการให้ มีความหมายต่ออนาคตของการแพทย์</span><a href="#how-to">รู้จักการบริจาคผ่าน e-Donation <span aria-hidden="true">↗</span></a></div>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <button className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"} aria-expanded={menuOpen} aria-controls="main-nav"><span /><span /><span /></button>
          <nav id="main-nav" className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="เมนูหลัก">
            <a className="nav-home" href="#main" onClick={() => setMenuOpen(false)}>หน้าแรก</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>รู้จักกองทุน</a>
            <a href="#how-to" onClick={() => setMenuOpen(false)}>ขั้นตอนการบริจาค</a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>ติดต่อเรา</a>
            <a className="button button-small" href="#funds" onClick={() => setMenuOpen(false)}><Icon name="heart" size={17} /> ร่วมบริจาค</a>
          </nav>
        </div>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="eyebrow"><span className="status-dot" /> MEDICAL SCHOLARSHIP FUND</div>
              <h1 id="hero-title">ให้โอกาสวันนี้<br />สร้าง<span className="highlight">หมอที่ดี</span><br />ในวันข้างหน้า<span className="heading-period">.</span></h1>
              <p className="hero-description">ร่วมเติมเต็มความฝันให้นิสิตแพทย์ มหาวิทยาลัยพะเยา<br className="desktop-break" /> ด้วยทุนการศึกษาจากน้ำใจของคุณ เพื่อให้พวกเขา<br className="desktop-break" /> เติบโตเป็นหมอที่พร้อมกลับมาดูแลสังคม</p>
              <div className="hero-actions"><a href="#funds" className="button"><Icon name="heart" size={19} /> ร่วมส่งต่อโอกาส <Icon name="arrow" size={18} /></a><a href="#about" className="text-link">รู้จักกองทุนของเรา <span aria-hidden="true">↗</span></a></div>
              <div className="hero-note"><Icon name="shield" size={16} /><span>บริจาคได้โดยไม่ต้องสมัครสมาชิก</span><span className="note-divider" /><span>รับใบอนุโมทนาบัตรทางอีเมล</span></div>
            </div>
            <div className="hero-visual">
              <div className="hero-decoration" aria-hidden="true"><svg viewBox="0 0 120 46" fill="none"><path d="M1 26h28l9-13 12 27L65 3l12 23h42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <div className="hero-photo" role="region" aria-roledescription="สไลด์ภาพ" aria-label="โอกาสทางการศึกษา">
                <Image key={currentSlide.image} src={currentSlide.image} alt={currentSlide.alt} fill sizes="(max-width: 760px) 92vw, (max-width: 1100px) 48vw, 590px" preload={slide === 0} className="hero-image" />
                <span className="photo-tag"><span /> ส่งต่อโอกาส สร้างอนาคต</span>
                <div className="photo-caption" aria-live="polite"><p>{currentSlide.label}</p><span>{currentSlide.detail}</span></div>
                <div className="carousel-dots">{slides.map((_, index) => <button key={index} type="button" aria-label={`แสดงภาพที่ ${index + 1}`} aria-current={slide === index ? "true" : undefined} className={slide === index ? "active" : ""} onClick={() => setSlide(index)} />)}</div><div className="carousel-controls"><div className="carousel-arrows"><button type="button" onClick={() => setSlide((slide + slides.length - 1) % slides.length)} aria-label="ภาพก่อนหน้า">←</button><button type="button" onClick={() => setSlide((slide + 1) % slides.length)} aria-label="ภาพถัดไป">→</button></div></div>
              </div>
              <div className="giving-badge"><span className="giving-badge-icon"><Icon name="graduate" size={28} /></span><div><strong>หนึ่งทุนการศึกษา</strong><span>ต่อยอดได้อีกหลายชีวิต</span></div><span className="badge-sparkle" aria-hidden="true">✧</span></div>
              <span className="image-credit">ภาพประกอบแนวคิดกองทุนทุนการศึกษา</span>
            </div>
          </div>
        </section>
        <div className="benefits-bar"><div className="container benefits-grid">{benefits.map((item) => <div className="benefit" key={item.title}><span className="benefit-icon"><Icon name={item.icon} size={25} /></span><div><strong>{item.title}</strong><span>{item.detail}</span></div></div>)}</div></div>
        <section id="about" className="section about-section">
          <div className="container about-grid"><div><p className="section-label"><span /> THE GIFT OF OPPORTUNITY</p><h2>เพราะโอกาสในการเรียนรู้<br />คือจุดเริ่มต้นของ<span className="green-text">การดูแล</span></h2></div><div className="about-copy"><p>เส้นทางสู่การเป็นแพทย์ต้องอาศัยทั้งความมุ่งมั่นและโอกาส กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา จึงมุ่งสนับสนุนนิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ ให้ก้าวต่อไปบนเส้นทางที่ตั้งใจ</p><p>ทุกการสนับสนุนของคุณ คือส่วนหนึ่งที่ช่วยให้นิสิตได้เรียนรู้อย่างเต็มศักยภาพ และเติบโตไปเป็นบุคลากรทางการแพทย์เพื่อสังคม</p></div></div>
        </section>
        <section id="funds" className="section funds-section" aria-labelledby="funds-title">
          <div className="container">
            <div className="section-heading"><div><p className="section-label"><span /> CHOOSE YOUR IMPACT</p><h2 id="funds-title">เลือกให้…ในแบบที่คุณตั้งใจ</h2></div><p>ทุกน้ำใจมีปลายทางเดียวกัน<br />คืออนาคตที่ดีของนิสิตแพทย์</p></div>
            <div className="fund-grid">
              <article className="fund-card"><div className="fund-photo"><Image src="/images/learning.jpeg" alt="ภาพประกอบนิสิตฝึกทักษะทางการแพทย์" fill sizes="(max-width: 760px) 90vw, 560px" /><span className="fund-tag">เติมโอกาสให้คนที่ต้องการ</span></div><div className="fund-body"><div className="fund-title-row"><span className="fund-icon"><Icon name="graduate" size={27} /></span><span className="fund-number">01 / GENERAL FUND</span></div><h3>ทุนการศึกษาเพื่อนิสิตแพทย์</h3><p>สมทบกองทุนส่วนกลาง เพื่อให้คณะกรรมการพิจารณาจัดสรรทุนแก่นิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ ตามความจำเป็นและเกณฑ์ของคณะ</p><div className="fund-card-footer"><span><Icon name="check" size={15} /> คณะจัดสรรให้กับนิสิต</span><a href="#how-to" className="fund-link">ดูวิธีร่วมบริจาค <Icon name="arrow" size={18} /></a></div></div></article>
              <article className="fund-card"><div className="fund-photo"><Image src="/images/scholarship.jpeg" alt="ภาพประกอบนิสิตแพทย์ผู้มุ่งมั่นในการศึกษา" fill sizes="(max-width: 760px) 90vw, 560px" /><span className="fund-tag">ส่งต่อกำลังใจให้คนที่คุณเลือก</span></div><div className="fund-body"><div className="fund-title-row"><span className="fund-icon peach"><Icon name="user" size={26} /></span><span className="fund-number">02 / PERSONAL SCHOLARSHIP</span></div><h3>ทุนการศึกษาแบบระบุผู้รับทุน</h3><p>ร่วมสนับสนุนเส้นทางการเรียนของนิสิตแพทย์ที่คุณต้องการดูแล โดยระบุชื่อนิสิตผู้รับทุน เพื่อส่งมอบโอกาสและกำลังใจให้เขาได้ก้าวต่อไป</p><div className="fund-card-footer"><span><Icon name="check" size={15} /> ระบุชื่อนิสิตที่ต้องการสนับสนุน</span><a href="#how-to" className="fund-link">ดูวิธีร่วมบริจาค <Icon name="arrow" size={18} /></a></div></div></article>
            </div>
          </div>
        </section>
        <section id="how-to" className="section how-section" aria-labelledby="how-title">
          <div className="container"><div className="center-heading"><p className="section-label"><span /> A LITTLE GIVING, A BIG DIFFERENCE</p><h2 id="how-title">ส่งต่อโอกาสได้ ในไม่กี่ขั้นตอน</h2><p>เตรียมข้อมูลให้พร้อม แล้วร่วมเป็นส่วนหนึ่งของอนาคตที่ดี</p></div><ol className="steps-grid">{steps.map((step, index) => <li className="step" key={step.title}><div className="step-top"><span className="step-icon"><Icon name={step.icon} size={27} /></span><span className="step-number">0{index + 1}</span></div><h3>{step.title}</h3><p>{step.detail}</p></li>)}</ol><div className="tax-notice"><span className="tax-icon"><Icon name="clock" size={25} /></span><div><strong>อุ่นใจเรื่องข้อมูล e-Donation</strong><p>เจ้าหน้าที่จะนำส่งข้อมูลภายใน <b>2 สัปดาห์</b> หลังตรวจสอบยอดโอน หากพ้นกำหนดหรือต้องการแก้ไขข้อมูล สามารถติดต่อเจ้าหน้าที่ได้</p></div><a href="#contact">ติดต่อสอบถาม <Icon name="arrow" size={18} /></a></div></div>
        </section>
        <FundNews />
        <section id="faq" className="section faq-section"><div className="container faq-grid"><div className="faq-intro"><p className="section-label"><span /> HERE TO HELP</p><h2>ทุกข้อสงสัย<br />เราใส่ใจตอบ</h2><p>ข้อมูลที่ควรรู้ก่อนร่วมบริจาค<br />เพื่อให้ทุกการให้เป็นเรื่องง่าย</p><a href="#contact" className="text-link">สอบถามเพิ่มเติม <Icon name="arrow" size={18} /></a></div><div className="faq-list">{faqs.map((faq, index) => <details key={faq.question} className="faq-item"><summary><span className="faq-index">0{index + 1}</span><span>{faq.question}</span><span className="faq-plus" aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></div></section>
        <section className="closing-section"><div className="container closing-inner"><div className="closing-art" aria-hidden="true"><Icon name="heart" size={74} /><span>✧</span></div><div><p className="section-label">A BETTER TOMORROW STARTS WITH YOU</p><h2>ความฝันของว่าที่หมอ<br />เดินต่อได้ ด้วยน้ำใจของคุณ</h2><p>ร่วมสร้างโอกาสทางการศึกษา เพื่อส่งต่อการดูแลที่ยั่งยืน</p></div><a href="#funds" className="button button-light">ร่วมส่งต่อโอกาส <Icon name="arrow" size={19} /></a></div></section>
      </main>
      <footer id="contact" className="site-footer">
        <div className="container footer-main"><div className="footer-brand"><Brand /><p>ให้โอกาสทางการศึกษา<br />สร้างอนาคตทางการแพทย์ไปด้วยกัน</p></div><div className="footer-links"><h3>สำรวจเว็บไซต์</h3><a href="#about">รู้จักกองทุน</a><a href="#funds">ทุนการศึกษา</a><a href="#how-to">ขั้นตอนการบริจาค</a><a href="#news">ข่าวสารและกิจกรรม</a><a href="#faq">คำถามที่พบบ่อย</a></div><div className="footer-contact"><h3>ติดต่อกองทุนทุนการศึกษา</h3><p><Icon name="pin" size={17} /><span>คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา<br />19 หมู่ 2 ต.แม่กา อ.เมืองพะเยา จ.พะเยา 56000</span></p><a href="tel:054466666"><Icon name="phone" size={16} /> 054-466-666 <span className="contact-extension">(งานทุนการศึกษา)</span></a><a href="mailto:medfund@up.ac.th"><Icon name="mail" size={17} /> medfund@up.ac.th</a></div></div>
        <div className="container footer-bottom"><span>MED UP e-Donation · ระบบบริจาคทุนการศึกษาสำหรับนิสิตแพทย์</span><a href="/login">เข้าสู่ระบบเจ้าหน้าที่</a><span>© 2026 คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา</span></div>
      </footer>
    </>
  );
}
