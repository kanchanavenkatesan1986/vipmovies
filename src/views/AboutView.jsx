import React from 'react';

export default function AboutView() {
  return (
    <>
      <div className="about-card">
        <h1 className="about-title">About TVK Movies</h1>
        
        <p>
          TVK Movies – Vintage Cinema is a digital collection of classic films that are legally available in the public domain. 
          Our mission is to preserve and provide access to historical cinema for educational, archival, and entertainment purposes.
        </p>

        <h2>Public Domain Policy</h2>
        <p>
          All movies featured in this app/website are verified to be in the public domain. Public domain works are films whose copyrights have expired or were released into the public domain under applicable laws. These works are legally free to watch, distribute, and share.
        </p>

        <h2>Content Source & Attribution</h2>
        <p>
          Movie content is sourced from trusted public archives such as:
        </p>
        
        <ul className="about-list">
          <li><i className="fa-solid fa-circle"></i> Internet Archive (archive.org)</li>
          <li><i className="fa-solid fa-circle"></i> Wikimedia Commons</li>
          <li><i className="fa-solid fa-circle"></i> Other verified public domain repositories</li>
        </ul>

        <p>
          Each movie is clearly marked as Public Domain on its respective archive page. TVK Movies does not modify or claim ownership of any film content.
        </p>

        <h2>No Hosting Disclaimer</h2>
        <p>
          TVK Movies does not host, upload, or store any video files on its servers. All streaming links redirect users to official external public archives.
        </p>

        <h2>Copyright & DMCA Notice</h2>
        <p>
          If you are a copyright owner and believe that any material has been included in error, please contact us with proper documentation. We will review and remove the content promptly if necessary.
        </p>

        <h2>Educational Purpose</h2>
        <p>
          This platform is intended for educational, historical, and entertainment purposes. We aim to promote appreciation of classic cinema and film history.
        </p>

        <h2>Contact Information</h2>
        <p>
          For copyright concerns, corrections, or general inquiries:
        </p>
        
        <div className="contact-box">
          <i className="fa-solid fa-envelope" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
          <span>Email: <a href="mailto:kanchanavenkatasen1986@email.com">kanchanavenkatasen1986@email.com</a></span>
        </div>
      </div>

      <div className="about-footer">
        © 2026 TVK Movies – Vintage Cinema<br />
        All content is sourced from public domain archives.
      </div>
    </>
  );
}
