import type { Profile } from "../types";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

/**
 * Slim pilot identity row above the bids list. Layout:
 *
 *   ┌────────────┐  Name (large)
 *   │ Logo 180×80│  Ident · Rank · Airline      📍 EDDM  🏠 EDDV  [⏻]
 *   └────────────┘
 *
 * Logo is 180×80 (= GSG native size, 2.25:1 ratio) on a white
 * background — airline logos are universally designed for white,
 * forcing the bg means a Turkish red, a GSG dark-blue, a Lufthansa
 * yellow all render correctly. Pre-v0.1.30 the logo lived in a
 * 36×36 square on a dark surface and was effectively invisible.
 *
 * Tooltips on 📍/🏠 say "laut Webseite ({{airline}})" — using the
 * airline ICAO from the profile so multi-VA pilots can tell which
 * site a stale value is coming from. Falls back to "Webseite" alone
 * when the airline relation isn't set.
 */
export function PilotHeader({ profile, onLogout }: Props) {
  const airline = profile.airline;
  const firstName = profile.name.split(" ")[0];

  return (
    <section className="stratos-dashboard-header">
      <div className="stratos-welcome-banner">
        <div className="stratos-welcome-content">
          <h1>Welcome back, {firstName}.</h1>
        </div>
        {airline?.logo && (
          <div className="stratos-welcome-logo">
            <img src={airline.logo} alt={airline.name} />
          </div>
        )}
      </div>

      <div className="stratos-dashboard-grid">
        <div className="stratos-card stratos-profile-card">
          <div className="stratos-card__header">
            <span className="stratos-card__dot"></span> MY PROFILE
            <button onClick={onLogout} className="stratos-card__action">Edit</button>
          </div>
          <div className="stratos-profile-info">
             <div className="stratos-profile-avatar">
                {airline?.icao ?? "✈"}
             </div>
             <div className="stratos-profile-details">
                <h2>{profile.name}</h2>
                <p>{profile.ident && `${profile.ident} · `}{airline?.icao}</p>
             </div>
          </div>
          <div className="stratos-profile-stats">
             <div className="stratos-stat">
                <span className="stratos-stat-value">{profile.curr_airport ?? "—"}</span>
                <span className="stratos-stat-label">LOCATION</span>
             </div>
             <div className="stratos-stat">
                <span className="stratos-stat-value">{profile.home_airport ?? "—"}</span>
                <span className="stratos-stat-label">HOME</span>
             </div>
             {profile.rank?.name && (
               <div className="stratos-stat">
                  <span className="stratos-stat-value">{profile.rank.name}</span>
                  <span className="stratos-stat-label">RANK</span>
               </div>
             )}
          </div>
        </div>
      </div>
    </section>
  );
}
