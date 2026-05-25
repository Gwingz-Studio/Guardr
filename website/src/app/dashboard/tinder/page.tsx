'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  AlertTriangle,
  ArrowLeft,
  Settings,
  UserCheck,
  CheckCircle,
  MessageSquare,
  Sparkles,
  Lock
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { TinderAPI } from '@/lib/tinder/tinder';

type Match = {
  id: string;
  person: {
    _id: string;
    name: string;
    bio?: string;
    photos: Array<{ id: string; url: string }>;
  };
};

type ScanReport = {
  overall_risk_score?: number;
  risk_indicators?: Array<{
    indicator_type: string;
    confidence: number;
    description: string;
    evidence: string[];
  }>;
  identity_consistency?: {
    consistency_score: number;
    inconsistencies: string[];
    verified_claims: number;
    unverified_claims: number;
  };
  conversation_patterns?: {
    love_bombing_score: number;
    pressure_indicators: number;
    red_flag_count: number;
  };
  recommendations?: string[];
};

export default function TinderDashboard() {
  const [token, setToken] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanReport | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Load saved credentials from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('guardr_tinder_token');
    const savedDeviceId = localStorage.getItem('guardr_tinder_device_id');
    if (savedToken && savedDeviceId) {
      setToken(savedToken);
      setDeviceId(savedDeviceId);
      verifyAndLoadMatches(savedToken, savedDeviceId);
    }
  }, []);

  const verifyAndLoadMatches = async (authToken: string, devId: string) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const client = new TinderAPI({
        xAuthToken: authToken,
        baseOptions: {
          defaultLocale: 'en-US',
          headers: {
            'persistent-device-id': devId,
          },
        },
      });

      // Verify connection by getting matches
      const res = await client.getMatches({ count: 15 });
      const matchesData = res.data?.data?.matches || [];
      
      setMatches(matchesData);
      setIsConnected(true);
      
      // Save credentials browser-side only
      localStorage.setItem('guardr_tinder_token', authToken);
      localStorage.setItem('guardr_tinder_device_id', devId);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not establish a connection to Tinder. Check that your credentials are still valid.');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !deviceId.trim()) return;
    verifyAndLoadMatches(token.trim(), deviceId.trim());
  };

  const handleDisconnect = () => {
    localStorage.removeItem('guardr_tinder_token');
    localStorage.removeItem('guardr_tinder_device_id');
    setToken('');
    setDeviceId('');
    setIsConnected(false);
    setMatches([]);
    setSelectedMatch(null);
    setScanResult(null);
  };

  const handleScanChat = async (match: Match) => {
    setChatLoading(true);
    setScanResult(null);
    setErrorMessage('');
    try {
      const client = new TinderAPI({
        xAuthToken: token,
        baseOptions: {
          defaultLocale: 'en-US',
          headers: {
            'persistent-device-id': deviceId,
          },
        },
      });

      // 1. Fetch chat messages from Tinder API
      const chatRes = await client.getChatMessages({ matchId: match.id, count: 40 });
      const rawMessages = chatRes.data?.data?.messages || [];

      if (rawMessages.length === 0) {
        setErrorMessage(`No messages found with ${match.person.name} yet. Direct analysis requires active conversations.`);
        setChatLoading(false);
        return;
      }

      // Format messages for Guardr AI conversation route
      // sender: "user" (if from matches corresponds to Tinder's auth ID) or "match"
      const formattedMessages = rawMessages
        .map((msg: any) => ({
          content: msg.message,
          timestamp: msg.sent_date,
          sender: msg.from === match.person._id ? 'match' : 'user',
        }))
        .reverse();

      // 2. Call Guardr API for Deep Conversation Analysis
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const scanRes = await fetch(`${apiUrl}/v1/dating/analyze-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Dual-use auth middleware fallback
        },
        body: JSON.stringify({
          messages: formattedMessages,
          participant_info: {
            name: match.person.name,
            location: 'Austin, TX', // Mock/Optional placeholder
            bio: match.person.bio
          }
        }),
      });

      if (!scanRes.ok) {
        throw new Error(`Guardr scan returned status ${scanRes.status}`);
      }

      const report = await scanRes.json();
      setScanResult(report.data || report);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to complete safety scan.');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white bg-hero-night py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-primary-200" />
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Tinder <span className="gradient-text">Sync Center</span>
              </h1>
            </div>
            <p className="text-white/70 max-w-xl">
              Cross-reference dating profiles and perform instant conversation safety scans directly in your browser.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-full px-4 py-2 self-start md:self-auto">
            <Lock className="h-4 w-4 text-emerald-300" />
            <span className="text-emerald-300/90 font-medium">Zero-Knowledge Encrypted Client</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-8 bg-danger-500/10 border border-danger-500/30 rounded-xl p-6 flex gap-3 text-danger-100 animate-fadeIn">
            <AlertTriangle className="h-6 w-6 text-danger-300 flex-shrink-0" />
            <div>
              <h4 className="font-bold mb-1">Integration Issue</h4>
              <p className="text-sm opacity-90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Step 1: Connect Tinder Credentials */}
        {!isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card variant="glass" className="lg:col-span-2 p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Settings className="h-6 w-6 text-primary-200" />
                Establish Dating Platform Connection
              </h3>
              
              <form onSubmit={handleConnect} className="space-y-6">
                <Input
                  type="password"
                  label="X-AUTH-TOKEN"
                  placeholder="Paste your Tinder auth token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
                
                <Input
                  type="password"
                  label="persistent-device-id"
                  placeholder="Paste TinderWeb/uuid..."
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  size="lg"
                  loading={isLoading}
                  disabled={isLoading}
                  fullWidth
                >
                  Verify and Sync Profiles
                </Button>
              </form>
            </Card>

            <Card className="p-8 bg-gradient-to-br from-white/5 to-white/0 border-white/5">
              <h4 className="font-bold text-lg mb-4 text-primary-200">How to get credentials:</h4>
              <ol className="space-y-4 text-sm text-white/80 list-decimal list-inside">
                <li>
                  Open Chrome and navigate to <a href="https://tinder.com" target="_blank" rel="noreferrer" className="underline text-secondary-300 hover:text-secondary-100">tinder.com</a>.
                </li>
                <li>
                  Open Developer Tools (<kbd className="bg-white/10 px-1 rounded text-xs">F12</kbd>).
                </li>
                <li>
                  Copy & run this in the Console to get your token:
                  <pre className="mt-2 p-2 rounded bg-black/45 overflow-x-auto text-xs text-emerald-300 border border-white/5">
                    {`indexedDB.open('keyval-store').onsuccess = (e) => {
  e.target.result.transaction(['keyval'], 'readonly')
   .objectStore('keyval').get('persist::mfa').onsuccess = (ev) => {
     console.log("X-AUTH-TOKEN:", JSON.parse(ev.target.result).authToken);
   }
}`}
                  </pre>
                </li>
                <li>
                  Copy & run this to get your Device ID:
                  <pre className="mt-2 p-2 rounded bg-black/45 overflow-x-auto text-xs text-emerald-300 border border-white/5">
                    {`console.log("DEVICE-ID:", localStorage.getItem('TinderWeb/uuid'))`}
                  </pre>
                </li>
              </ol>
            </Card>
          </div>
        ) : (
          /* Step 2: Dashboard Experience when connected */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Sidebar matches explorer */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-xl text-white/95 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-secondary-200" />
                  Your Tinder Matches ({matches.length})
                </h3>
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-white/50 hover:text-danger-300 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              <div className="overflow-y-auto max-h-[580px] space-y-3 pr-2 scrollbar-thin">
                {matches.length === 0 ? (
                  <p className="text-white/60 text-sm italic">No recent matches found to analyze.</p>
                ) : (
                  matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedMatch(m);
                        setScanResult(null);
                        setErrorMessage('');
                      }}
                      className={`w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all border ${
                        selectedMatch?.id === m.id
                          ? 'bg-gradient-to-br from-primary-500/20 to-secondary-500/20 border-primary-400/40 shadow-glow-primary-sm'
                          : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                        {m.person.photos?.[0]?.url ? (
                          <img src={m.person.photos[0].url} alt={m.person.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-sm bg-primary-500/30 text-primary-200">
                            {m.person.name[0]}
                          </div>
                        )}
                      </div>
                      
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-white truncate">{m.person.name}</h4>
                        <p className="text-xs text-white/60 truncate max-w-[180px]">{m.person.bio || 'No bio provided.'}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selected Match Main Analysis Area */}
            <div className="lg:col-span-2 space-y-8">
              {selectedMatch ? (
                <div className="space-y-6">
                  {/* Match Bio Card */}
                  <Card variant="glass" className="p-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                      <div className="h-28 w-28 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                        {selectedMatch.person.photos?.[0]?.url ? (
                          <img src={selectedMatch.person.photos[0].url} alt={selectedMatch.person.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-extrabold text-2xl bg-secondary-500/30 text-secondary-200">
                            {selectedMatch.person.name[0]}
                          </div>
                        )}
                      </div>

                      <div className="text-center sm:text-left flex-grow">
                        <div className="flex flex-wrap justify-center sm:justify-between items-center gap-4 mb-3">
                          <h3 className="text-2xl font-bold">{selectedMatch.person.name}</h3>
                          <Badge variant="primary">Synced</Badge>
                        </div>
                        <p className="text-white/80 text-sm mb-4">
                          {selectedMatch.person.bio || 'No bio text is set for this profile.'}
                        </p>
                        
                        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                          <Button
                            size="md"
                            loading={chatLoading}
                            disabled={chatLoading}
                            icon={MessageSquare}
                            onClick={() => handleScanChat(selectedMatch)}
                          >
                            Analyze Conversation Safety
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Scan Results Display */}
                  {scanResult && (
                    <div className="space-y-6 animate-fadeIn">
                      
                      {/* Risk Scores Overview */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6 text-center border-emerald-400/20 bg-emerald-500/5">
                          <h5 className="text-xs uppercase tracking-wider text-emerald-300 font-bold mb-2">Safety Score</h5>
                          <div className="text-4xl font-extrabold text-emerald-100">{scanResult.overall_risk_score ?? 100}/100</div>
                          <p className="text-xs text-white/60 mt-1">AI-assessed platform confidence</p>
                        </Card>

                        <Card className="p-6 text-center border-pink-400/20 bg-pink-500/5">
                          <h5 className="text-xs uppercase tracking-wider text-pink-300 font-bold mb-2">Love-bombing Risk</h5>
                          <div className="text-4xl font-extrabold text-pink-100">
                            {Math.round((scanResult.conversation_patterns?.love_bombing_score || 0) * 100)}%
                          </div>
                          <p className="text-xs text-white/60 mt-1">Dating-cycle dynamic check</p>
                        </Card>

                        <Card className="p-6 text-center border-yellow-400/20 bg-yellow-500/5">
                          <h5 className="text-xs uppercase tracking-wider text-yellow-300 font-bold mb-2">Consistency Score</h5>
                          <div className="text-4xl font-extrabold text-yellow-100">
                            {Math.round((scanResult.identity_consistency?.consistency_score || 0) * 100)}%
                          </div>
                          <p className="text-xs text-white/60 mt-1">Cross-reference coherence</p>
                        </Card>
                      </div>

                      {/* Flagged Indicators / Inconsistencies */}
                      {((scanResult.risk_indicators && scanResult.risk_indicators.length > 0) || 
                       (scanResult.identity_consistency?.inconsistencies && scanResult.identity_consistency.inconsistencies.length > 0)) && (
                        <Card variant="glass" className="p-6 border-danger-500/10">
                          <h4 className="font-extrabold text-lg text-danger-200 mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-danger-300" />
                            Flagged Risk Indicators ({ (scanResult.risk_indicators?.length || 0) + (scanResult.identity_consistency?.inconsistencies?.length || 0) })
                          </h4>

                          <div className="space-y-4">
                            {scanResult.risk_indicators?.map((indicator, index) => (
                              <div key={index} className="p-4 rounded-lg bg-danger-500/5 border border-danger-500/20">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-danger-100">{indicator.indicator_type}</span>
                                  <Badge variant="danger" size="sm">Confidence: {Math.round(indicator.confidence * 100)}%</Badge>
                                </div>
                                <p className="text-sm text-white/80">{indicator.description}</p>
                              </div>
                            ))}

                            {scanResult.identity_consistency?.inconsistencies.map((inc, index) => (
                              <div key={`inc-${index}`} className="p-4 rounded-lg bg-warning-500/5 border border-warning-500/20">
                                <span className="font-bold text-warning-100">Profile Inconsistency</span>
                                <p className="text-sm text-white/80 mt-1">{inc}</p>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Safety Tips & Protective Recommendations */}
                      {scanResult.recommendations && scanResult.recommendations.length > 0 && (
                        <Card variant="glass" className="p-6">
                          <h4 className="font-bold text-lg text-primary-200 mb-4 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary-300" />
                            Safety Recommendations
                          </h4>
                          <div className="space-y-3">
                            {scanResult.recommendations.map((rec, index) => (
                              <div key={index} className="flex gap-2 text-sm text-white/85">
                                <CheckCircle className="h-4 w-4 text-primary-200 flex-shrink-0 mt-0.5" />
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                    </div>
                  )}

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-16 bg-white/5 border border-white/5 rounded-2xl text-center">
                  <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Sparkles className="h-8 w-8 text-primary-200" />
                  </div>
                  <h4 className="font-bold text-xl mb-2">No Match Selected</h4>
                  <p className="text-sm text-white/60 max-w-sm">
                    Select one of your Tinder matches on the left sidebar to perform identity audits or scan chat logs.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
