"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import PreferencesForm, { Preferences } from "@/components/PreferencesForm";
import { useAuth } from "@/components/AuthProvider";
import { generateMatchRankingsForUser } from "@/lib/matching";

type Flight = {
  flightNumber: string;
  origin: string;
  destination: string;
};

type JoinedFlight = Flight & { code: string };

type Passenger = {
  uid: string;
  name: string;
  travellerType?: string;
  connectReasons?: string[];
  personality?: string;
  interests?: string[];
  stayAwake?: string;
  visibility?: {
    travellerType?: boolean;
    connectReasons?: boolean;
    personality?: boolean;
    interests?: boolean;
    stayAwake?: boolean;
  };
};

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [flightCode, setFlightCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [myFlights, setMyFlights] = useState<JoinedFlight[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  
  // Track connected passenger UIDs for button state
  const [connectedUids, setConnectedUids] = useState<string[]>([]);

  // If not logged in, go to the signup page
  useEffect(() => {
    if (!loading && !user) {
      router.push("/signup");
    }
  }, [user, loading, router]);

  // Listen to the rooms this user has joined
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      collection(db, "users", user.uid, "flights"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as JoinedFlight);
        setMyFlights(list);
      },
      (err) => console.error(err)
    );

    return () => unsubscribe();
  }, [user]);

  // Get the active flight from database (most recent flight joined)
  const activeFlight = myFlights.length > 0 ? myFlights[0] : null;

  // Listen live to passengers for the active flight
  useEffect(() => {
    if (!user || !activeFlight) {
      setPassengers([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "flights", activeFlight.code, "passengers"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as Passenger);
        setPassengers(list);
      },
      (err) => console.error(err)
    );

    return () => unsubscribe();
  }, [user, activeFlight]);

  // Compute live match rankings for the current user
  const matchRankings = useMemo(
    () => (user ? generateMatchRankingsForUser(passengers, user.uid) : []),
    [user, passengers]
  );

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setCode("");
      setFlightCode("");
      setError("");
      setFlight(null);
    }
  }

  function handleConnectClick(targetUid: string) {
    if (!connectedUids.includes(targetUid)) {
      setConnectedUids((prev) => [...prev, targetUid]);
    }
  }

  async function handleCheckCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setChecking(true);

    try {
      const cleanCode = code.trim().toUpperCase();
      const snapshot = await getDoc(doc(db, "flights", cleanCode));

      if (snapshot.exists()) {
        setFlight(snapshot.data() as Flight);
        setFlightCode(cleanCode);
      } else {
        setError("Invalid flight code. Please check and try again.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
    setChecking(false);
  }

  async function handlePrefsSubmit(prefs: Preferences) {
    if (!user || !flight) return;
    setError("");
    setSaving(true);

    try {
      const batch = writeBatch(db);

      batch.set(doc(db, "flights", flightCode, "passengers", user.uid), {
        uid: user.uid,
        name: user.displayName ?? "Traveller",
        ...prefs,
        joinedAt: serverTimestamp(),
      });

      batch.set(doc(db, "users", user.uid, "flights", flightCode), {
        code: flightCode,
        flightNumber: flight.flightNumber,
        origin: flight.origin,
        destination: flight.destination,
        joinedAt: serverTimestamp(),
      });

      await batch.commit();
      router.push(`/dashboard/${flightCode}`);
    } catch (err) {
      console.error(err);
      setError("Could not save your preferences. Please try again.");
      setSaving(false);
    }
  }

  if (loading || !user) {
    return null;
  }

  return (
    <>
      <Navbar />

      <main>
        {/* Glorious Large Page Heading */}
        <div className="page-head">
          <div>
            <h1 style={{ fontSize: "36px", fontWeight: "600", letterSpacing: "-0.02em" }}>
              Dashboard
            </h1>
            <p className="lead">
              Welcome back, {user.displayName ?? "Traveller"}.
            </p>
          </div>
          <button onClick={() => setOpen(true)} className="btn">
            + JOIN ROOM
          </button>
        </div>

        <div className="grid stack">
          {/* Active Flight Hero Banner */}
          {activeFlight ? (
            <div className="flight">
              <div className="flight-info">
                <div>
                  <span className="pill">Current Flight Room</span>
                  <div className="route" style={{ marginTop: "12px" }}>
                    <div>
                      <b>{activeFlight.origin}</b>
                    </div>
                    <div className="line">
                      <i />
                      <svg className="i" viewBox="0 0 24 24">
                        <path d="M22 16.5l-9-5.5V3a1.5 1.5 0 0 0-3 0v8L1 16.5V19l9-2.5V21l-2 1.5V24l3.5-1 3.5 1v-1.5L13 21v-4.5l9 2.5z" />
                      </svg>
                      <i />
                    </div>
                    <div>
                      <b>{activeFlight.destination}</b>
                    </div>
                  </div>
                </div>
                <div className="meta">
                  <b>Flight: {activeFlight.flightNumber}</b> &bull; Room Code: {activeFlight.code}
                </div>
              </div>
              <img
                className="flight-photo"
                src="https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80"
                alt="Destination Skyline"
              />
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <h2>No flights joined yet</h2>
              <p className="muted" style={{ marginTop: "8px", marginBottom: "16px" }}>
                Enter your flight code to join a room and connect with fellow travellers.
              </p>
              <button onClick={() => setOpen(true)} className="btn">
                + JOIN ROOM
              </button>
            </div>
          )}

          {/* Joined Flight Rooms Grid */}
          {myFlights.length > 0 && (
            <section>
              <h2 style={{ marginBottom: "14px" }}>Your joined flights</h2>
              <div className="grid g3">
                {myFlights.map((f) => (
                  <Link
                    key={f.code}
                    href={`/dashboard/${f.code}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="card"
                      style={{ transition: "box-shadow 0.15s", cursor: "pointer" }}
                    >
                      <h3 style={{ marginBottom: "6px" }}>{f.code}</h3>
                      <p className="muted small">
                        {f.flightNumber}: {f.origin} &rarr; {f.destination}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Main 2-Column Grid */}
          <div className="grid g-main">
            {/* Left Column: Top Matches */}
            <div className="stack">
              <div className="card">
                <div className="card-head">
                  <h2>Top Matches</h2>
                  <span className="tag">
                    {activeFlight ? `${activeFlight.flightNumber} Passengers` : "Passengers"}
                  </span>
                </div>
                <div className="results">
                  {matchRankings.length > 0 ? (
                    matchRankings.slice(0, 4).map((match) => {
                      const isYou = match.matched_id === user.uid;
                      if (isYou) return null;

                      // Find full raw passenger details from database for this match
                      const rawPassenger = passengers.find((p) => p.uid === match.matched_id);
                      const isConnected = connectedUids.includes(match.matched_id);

                      return (
                        <div className="mate" key={match.matched_id}>
                          <div className="mate-top">
                            <div className="av c1">
                              {match.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="nm">
                              <b>{match.name}</b>
                              <span>{rawPassenger?.travellerType || "Passenger"}</span>
                            </div>
                            <div
                              className="ring"
                              style={{ "--p": match.score } as React.CSSProperties}
                            >
                              <span>{match.score}%</span>
                            </div>
                          </div>

                          {/* Chips Container: Personality + Interests */}
                          <div className="chips">
                            {rawPassenger?.personality && (
                              <span
                                className="tag"
                                style={{
                                  backgroundColor: "var(--light-sand)",
                                  color: "#33291a",
                                  borderRadius: "999px",
                                  padding: "5px 11px",
                                  fontSize: "13px",
                                  fontWeight: 500,
                                }}
                              >
                                {rawPassenger.personality}
                              </span>
                            )}

                            {rawPassenger?.interests &&
                              rawPassenger.interests.map((interest: string) => (
                                <span key={interest} className="chip soft">
                                  {interest}
                                </span>
                              ))}
                          </div>

                          {/* Action Buttons */}
                          <div
                            className="mate-actions"
                            style={{ marginTop: "12px", display: "flex", gap: "8px" }}
                          >
                            <button
                              className="btn sm"
                              disabled={isConnected}
                              onClick={() => handleConnectClick(match.matched_id)}
                              style={
                                isConnected
                                  ? {
                                      backgroundColor: "var(--light-slate)",
                                      color: "var(--muted)",
                                      borderColor: "var(--slate)",
                                      cursor: "not-allowed",
                                    }
                                  : {}
                              }
                            >
                              {isConnected ? "Connection request sent ⏳" : "Connect"}
                            </button>

                            {activeFlight && (
                              <Link href={`/dashboard/${activeFlight.code}`}>
                                <button className="btn sm ghost">View Room</button>
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="muted small">No other passengers found in this room yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Suggested Trip Packages */}
            <div className="stack">
              <div className="card">
                <div className="card-head">
                  <h2>Suggested Trips</h2>
                  <span className="tag">CX Destinations</span>
                </div>
                <div className="grid" style={{ gap: "14px" }}>
                  <div className="trip">
                    <div className="sw">
                      LON
                      <small>5 Days</small>
                    </div>
                    <div className="bd">
                      <h3>London Cultural Tour</h3>
                      <p>Curated West End shows, historic museums & food market experiences.</p>
                      <div>
                        <button className="btn sm ghost">View Package</button>
                      </div>
                    </div>
                  </div>

                  <div className="trip">
                    <div className="sw">
                      HKG
                      <small>3 Days</small>
                    </div>
                    <div className="bd">
                      <h3>Hong Kong Harbor Highlights</h3>
                      <p>Explore Victoria Peak, night markets, and local dim sum spots.</p>
                      <div>
                        <button className="btn sm ghost">View Package</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Dialog for Joining Room */}
        {open && (
          <div className="modal" onClick={() => handleOpenChange(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h3>
                {flight
                  ? `${flight.flightNumber}: ${flight.origin} → ${flight.destination}`
                  : "Join a flight room"}
              </h3>
              <p className="muted small" style={{ marginBottom: "16px" }}>
                {flight
                  ? "Tell us about yourself so we can match you with fellow passengers."
                  : "Enter the flight code you received when you bought your ticket."}
              </p>

              {!flight ? (
                <form
                  onSubmit={handleCheckCode}
                  className="grid"
                  style={{ gap: "14px" }}
                >
                  <div>
                    <label className="lbl" htmlFor="flightCode">
                      Flight code
                    </label>
                    <input
                      id="flightCode"
                      type="text"
                      placeholder="e.g. CX100-DEMO"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p className="small" style={{ color: "var(--saffron)" }}>
                      {error}
                    </p>
                  )}
                  <button type="submit" className="btn" disabled={checking}>
                    {checking ? "Checking..." : "Continue"}
                  </button>
                </form>
              ) : (
                <div className="grid" style={{ gap: "12px" }}>
                  <PreferencesForm onSubmit={handlePrefsSubmit} />
                  {saving && <p className="small muted">Saving...</p>}
                  {error && (
                    <p className="small" style={{ color: "var(--saffron)" }}>
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}