export default function NotFound() {
  return (
    <div className="site">
      <section className="s-sec">
        <div className="s-wrap s-center">
          <h1>Page not found</h1>
          <p className="s-muted">The page you are looking for does not exist or has moved.</p>
          <a className="s-btn primary" href="/">
            Go to the home page
          </a>
        </div>
      </section>
    </div>
  );
}
