import React from "react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <p style={styles.text}>
          © {currentYear} Warung Ndeso. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

const styles = {
  footer: {
    backgroundColor: "#c0392b",
    color: "#ffffff",
    padding: "20px 0",
    textAlign: "center",
    marginTop: "auto",
    width: "100%",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "0 20px",
  },
  text: {
    fontSize: "14px",
    margin: 0,
    opacity: "0.8",
  },
};

export default Footer;