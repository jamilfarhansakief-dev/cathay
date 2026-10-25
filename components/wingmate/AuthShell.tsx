import "./tokens.css";
import "./auth.css";

type Props = { heroTitle: string; heroText: string; children: React.ReactNode };

export default function AuthShell({ heroTitle, heroText, children }: Props) {
  return (
    <div className="wm-auth">
      <div className="page">
        <aside className="hero">
          <div className="lockup" role="img" aria-label="Cathay Pacific | WingMate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cx-logo" src="/images/cathay-logo.png" alt="" />
            <span className="divider" aria-hidden="true" />
            <span className="app-name">WingMate</span>
          </div>
          <figure className="photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/a350.jpg" alt="A Cathay Pacific Airbus A350 in flight" />
          </figure>
          <div className="hero-copy">
            <h2>{heroTitle}</h2>
            <p>{heroText}</p>
            <div className="chips">
              <span>Chat before &amp; during flight</span>
              <span>Match by interests</span>
              <span>Trip itineraries</span>
            </div>
          </div>
        </aside>
        <main className="panel">
          <section className="card">{children}</section>
        </main>
      </div>
    </div>
  );
}