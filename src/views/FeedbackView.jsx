import React, { useState } from 'react';

export default function FeedbackView() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'General Feedback',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Feedback submitted! Thank you.');
    setFormData({
      name: '',
      email: '',
      type: 'General Feedback',
      message: ''
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <div className="feedback-card">
        <h1 className="feedback-title">User Feedback</h1>
        <p>
          We value your feedback! Your suggestions help improve TVK Movies – Vintage Cinema. If you experience any issues, have recommendations, or notice layout bugs, please let us know.
        </p>

        <form className="feedback-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input 
              type="text" 
              name="name"
              className="form-control" 
              placeholder="Enter your name" 
              value={formData.name}
              onChange={handleChange}
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              name="email"
              className="form-control" 
              placeholder="Enter your email" 
              value={formData.email}
              onChange={handleChange}
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Feedback Type</label>
            <select 
              name="type"
              className="form-control" 
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value="General Feedback">General Feedback</option>
              <option value="Bug Report">Bug Report</option>
              <option value="Content Suggestion">Content Suggestion</option>
              <option value="Copyright Concern">Copyright Concern</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Your Message</label>
            <textarea 
              name="message"
              className="form-control" 
              placeholder="Write your message here..." 
              value={formData.message}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          <button type="submit" className="btn-submit">
            <i className="fa-solid fa-paper-plane"></i> Submit Feedback
          </button>
        </form>

        <div className="notice-section">
          <h2 className="notice-title">Important Notice</h2>
          <p className="notice-text">
            TVK Movies only provides access to films that are in the public domain. If you believe any content has been included incorrectly, please select "Copyright Concern" in the form above and provide reference links. We will review and take appropriate action immediately.
          </p>
        </div>
      </div>

      <div className="feedback-footer">
        © 2026 TVK Movies – Vintage Cinema<br />
        Public Domain Movies Only
      </div>
    </>
  );
}
