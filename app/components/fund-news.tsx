import Image from "next/image";

// Sample content from docs/med_up_e_donation (2).html until the news CMS is connected.
const articles = [
  {
    id: "PR-003",
    category: "รายงานผลการจัดสรรทุน",
    date: "2026-11-01",
    displayDate: "1 พฤศจิกายน 2569",
    title: "สรุปรายงานการจัดสรรทุนการศึกษาและแนวทางการส่งข้อมูล e-Donation",
    summary:
      "ติดตามการจัดสรรทุนการศึกษา พร้อมทำความเข้าใจขั้นตอนการนำส่งข้อมูล e-Donation หลังเจ้าหน้าที่ตรวจสอบยอดบริจาค",
    image: "/images/community.jpeg",
    imageAlt: "ภาพประกอบบุคลากรทางการแพทย์ดูแลสุขภาพของผู้คนในชุมชน",
    content: [
      "หลังเจ้าหน้าที่ตรวจสอบข้อมูลผู้บริจาคและหลักฐานการโอนเงิน จะจัดส่งใบอนุโมทนาบัตรอิเล็กทรอนิกส์รูปแบบ PDF ทางอีเมล และเตรียมข้อมูลเพื่อนำส่งระบบ e-Donation ของกรมสรรพากร",
      "การนำส่งข้อมูลดำเนินการภายใน 2 สัปดาห์หลังตรวจสอบยอดโอน หากพ้นกำหนดแล้วยังไม่พบข้อมูล หรือต้องการแก้ไขข้อมูลผู้บริจาค สามารถติดต่อเจ้าหน้าที่กองทุนได้",
    ],
  },
  {
    id: "PR-002",
    category: "พิธีมอบทุนการศึกษา",
    date: "2026-10-22",
    displayDate: "22 ตุลาคม 2569",
    title: "พิธีมอบทุนการศึกษาแก่นิสิตแพทย์ชั้นปีที่ 1–6 จำนวน 28 ทุน",
    summary:
      "ส่งต่อโอกาสจากน้ำใจของผู้มีจิตศรัทธา สู่ทุนการศึกษาที่ช่วยให้นิสิตแพทย์ก้าวต่อไปบนเส้นทางที่ตั้งใจ",
    image: "/images/learning.jpeg",
    imageAlt: "ภาพประกอบนิสิตแพทย์เรียนรู้ทักษะทางคลินิกกับอาจารย์แพทย์",
    content: [
      "คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา จัดพิธีมอบทุนการศึกษาจากกองทุนผู้มีจิตศรัทธา เพื่อต่อยอดโอกาสทางการศึกษาและสร้างบัณฑิตแพทย์คุณภาพ",
      "ผู้สนใจสนับสนุนทุนสามารถเลือกสมทบกองทุนที่คณะจัดสรรให้กับนิสิต หรือเลือกทุนแบบระบุชื่อนิสิตผู้รับทุนได้ตามความประสงค์",
    ],
  },
  {
    id: "PR-001",
    category: "ข่าวประชาสัมพันธ์",
    date: "2026-10-15",
    displayDate: "15 ตุลาคม 2569",
    title: "ร่วมสมทบกองทุนทุนการศึกษาสำหรับนิสิตแพทย์ ประจำปีการศึกษา 2569",
    summary:
      "ขอเชิญผู้มีจิตศรัทธา ศิษย์เก่า และองค์กร ร่วมเติมเต็มโอกาสทางการศึกษาให้นิสิตแพทย์ที่ขาดแคลนทุนทรัพย์",
    image: "/images/scholarship.jpeg",
    imageAlt: "ภาพประกอบนิสิตแพทย์ผู้มุ่งมั่นบนเส้นทางการศึกษา",
    content: [
      "กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา มุ่งสนับสนุนนิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ ให้ได้เรียนรู้อย่างเต็มศักยภาพและเติบโตเป็นบุคลากรทางการแพทย์เพื่อสังคม",
      "ก่อนทำรายการ กรุณาเตรียมข้อมูลผู้บริจาค อีเมลสำหรับรับใบอนุโมทนาบัตร และหลักฐานการโอนเงิน หากต้องการสนับสนุนนิสิตเป็นรายบุคคล ให้เตรียมชื่อ–นามสกุลของนิสิตผู้รับทุนด้วย",
    ],
  },
];

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}

export default function FundNews() {
  return (
    <section id="news" className="section news-section" aria-labelledby="news-title" aria-describedby="news-sample-note">
      <div className="container">
        <div className="section-heading news-heading">
          <div>
            <p className="section-label"><span /> STORIES OF GIVING</p>
            <h2 id="news-title">ข่าวสารและกิจกรรมกองทุน</h2>
          </div>
          <p>ติดตามเรื่องราวของการให้<br />และความเคลื่อนไหวของกองทุน</p>
        </div>
        <p id="news-sample-note" className="news-sample-note">ข่าวและภาพประกอบตัวอย่างจากเอกสารโครงการ</p>
        <div className="news-grid">
          {articles.map((article) => (
            <article key={article.id} className="news-card" aria-labelledby={`news-title-${article.id}`}>
              <div className="news-photo">
                <Image src={article.image} alt={article.imageAlt} fill sizes="(max-width: 760px) 90vw, (max-width: 1100px) 45vw, 390px" />
                <span className="news-image-label">ภาพประกอบ</span>
              </div>
              <div className="news-body">
                <div className="news-meta"><span className="news-category">{article.category}</span><time dateTime={article.date}>{article.displayDate}</time></div>
                <h3 id={`news-title-${article.id}`}>{article.title}</h3>
                <p className="news-summary">{article.summary}</p>
                <details className="news-details">
                  <summary>
                    <span className="news-read-more">อ่านเพิ่มเติม<span className="sr-only">: {article.title}</span></span>
                    <span className="news-read-less">ย่อรายละเอียด<span className="sr-only">: {article.title}</span></span>
                    <Arrow />
                  </summary>
                  <div className="news-details-content">
                    {article.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    <a href="#contact" className="text-link">สอบถามเจ้าหน้าที่กองทุน <Arrow /></a>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
