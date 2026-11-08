import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, View
} from "react-native";
import { API_BASE_URL, REFRESH_INTERVAL_MS } from "./src/config";

const C = {
  bg: "#050505", panel: "#111214", panel2: "#181a1d", line: "#292c30",
  text: "#f5f5f5", muted: "#92979f", green: "#b7f36b", red: "#ff5b62",
  gold: "#e8c66a"
};

const tabs = [
  { key: "live", label: "LIVE" },
  { key: "upcoming", label: "UPCOMING" },
  { key: "recent", label: "RESULTS" }
];

function clean(value, fallback = "Match information unavailable") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function MatchCard({ item, onPress, category }) {
  const live = category === "live";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.78 }]}>
      <View style={styles.cardTop}>
        <Text style={styles.series} numberOfLines={1}>{clean(item.series || item.subtitle, "INTERNATIONAL / LEAGUE")}</Text>
        {live ? <View style={styles.livePill}><View style={styles.liveDot}/><Text style={styles.liveText}>LIVE</Text></View> :
          <Text style={styles.status}>{category === "upcoming" ? "UPCOMING" : "RESULT"}</Text>}
      </View>
      <Text style={styles.matchTitle}>{clean(item.title || item.name, "Cricket match")}</Text>
      <View style={styles.scoreRow}>
        <View style={styles.scoreCol}>
          <Text style={styles.score}>{clean(item.score, category === "upcoming" ? "Starts soon" : "Score unavailable")}</Text>
          {!!item.score2 && <Text style={styles.scoreSecondary}>{item.score2}</Text>}
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
      <Text style={styles.matchNote} numberOfLines={2}>{clean(item.status || item.venue || item.time, "Tap for match details")}</Text>
    </Pressable>
  );
}

export default function App() {
  const [category, setCategory] = useState("live");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [scoreDetails, setScoreDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadMatches = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      if (!API_BASE_URL || API_BASE_URL.includes("YOUR-BACKEND")) {
        throw new Error("Connect your backend first. Add your Render URL in mobile/src/config.js.");
      }
      const response = await fetch(`${API_BASE_URL}/matches?category=${category}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.matches)) throw new Error("Unexpected API response. Expected a matches array.");
      setMatches(data.matches);
      setError(data.matches.length ? "" : "No matches were returned for this section.");
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message || "Could not load matches.");
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => {
    setLoading(true);
    loadMatches();
    const timer = setInterval(() => loadMatches(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadMatches]);

  const openMatch = async (item) => {
    setSelected(item);
    setScoreDetails(null);
    if (!item.id) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/score/${encodeURIComponent(item.id)}`);
      if (!response.ok) throw new Error("Score details are not available right now.");
      setScoreDetails(await response.json());
    } catch (e) {
      setScoreDetails({ error: e.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const heading = useMemo(() => tabs.find(t => t.key === category)?.label || "LIVE", [category]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}><Text style={{color:C.green}}>●</Text> CRICKET<Text style={{color:C.green}}>LIVE</Text></Text>
          <Text style={styles.tagline}>THE GAME, IN REAL TIME</Text>
        </View>
        <Pressable onPress={() => loadMatches(true)} style={styles.refreshButton}>
          <Text style={styles.refreshIcon}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {tabs.map(t => (
          <Pressable key={t.key} onPress={() => { setSelected(null); setCategory(t.key); }} style={[styles.tab, category === t.key && styles.activeTab]}>
            <Text style={[styles.tabText, category === t.key && styles.activeTabText]}>{t.label}</Text>
            {category === t.key && <View style={styles.tabUnderline}/>}
          </Pressable>
        ))}
      </View>

      {selected ? (
        <ScrollView style={styles.content} contentContainerStyle={{paddingBottom:36}}>
          <Pressable onPress={() => setSelected(null)} style={styles.back}><Text style={styles.backText}>‹  ALL MATCHES</Text></Pressable>
          <View style={styles.detailCard}>
            <Text style={styles.detailEyebrow}>MATCH CENTRE</Text>
            <Text style={styles.detailTitle}>{clean(selected.title || selected.name, "Match details")}</Text>
            <Text style={styles.detailScore}>{clean(selected.score, "Score unavailable")}</Text>
            {!!selected.status && <Text style={styles.detailStatus}>{selected.status}</Text>}
          </View>
          <Text style={styles.sectionTitle}>LIVE SCORECARD</Text>
          {detailLoading ? <ActivityIndicator color={C.green} style={{marginTop:24}}/> :
            scoreDetails?.error ? <Text style={styles.empty}>{scoreDetails.error}</Text> :
            scoreDetails ? (
              <View style={styles.card}>
                <Text style={styles.score}>{clean(scoreDetails.score, "Score unavailable")}</Text>
                <Text style={styles.matchNote}>{clean(scoreDetails.title, "")}</Text>
                <Text style={styles.playerHeading}>BATTERS</Text>
                {(scoreDetails.current_batsmen || []).map((p, i) => (
                  <View key={i} style={styles.playerRow}><Text style={styles.playerName}>{p.name}</Text><Text style={styles.playerScore}>{p.score}</Text></View>
                ))}
                <Text style={styles.playerHeading}>BOWLER</Text>
                <Text style={styles.playerName}>{scoreDetails.current_bowler?.name || "Not available"}</Text>
              </View>
            ) : <Text style={styles.empty}>Detailed scorecard is not available for this match.</Text>}
          <Text style={styles.disclaimer}>Scores are sourced from an unofficial data scraper and may be delayed or unavailable.</Text>
        </ScrollView>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{heading} MATCHES</Text>
              <Text style={styles.sectionSub}>{lastUpdated ? `UPDATED ${lastUpdated.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}` : "CRICKET SCORE CENTRE"}</Text>
            </View>
            {category === "live" && <View style={styles.livePill}><View style={styles.liveDot}/><Text style={styles.liveText}>LIVE NOW</Text></View>}
          </View>
          {loading ? <View style={styles.center}><ActivityIndicator size="large" color={C.green}/><Text style={styles.loadingText}>Loading matches…</Text></View> :
            error ? <View style={styles.emptyWrap}><Text style={styles.emptyIcon}>🏏</Text><Text style={styles.emptyTitle}>No match data</Text><Text style={styles.empty}>{error}</Text><Pressable onPress={() => loadMatches(true)} style={styles.retry}><Text style={styles.retryText}>TRY AGAIN</Text></Pressable></View> :
            <FlatList
              data={matches}
              keyExtractor={(item, index) => String(item.id || `${item.title}-${index}`)}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMatches(true)} tintColor={C.green}/>}
              renderItem={({item}) => <MatchCard item={item} category={category} onPress={() => openMatch(item)}/>}
              ListEmptyComponent={<Text style={styles.empty}>No matches available.</Text>}
            />}
        </>
      )}
      <View style={styles.footer}><Text style={styles.footerText}>MADE FOR THE LOVE OF CRICKET</Text><Text style={styles.footerDot}>●</Text><Text style={styles.footerText}>AUTO REFRESH 45S</Text></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg,paddingTop:StatusBar.currentHeight||0},
  header:{paddingHorizontal:22,paddingTop:18,paddingBottom:20,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  brand:{fontSize:23,fontWeight:"900",letterSpacing:1.5,color:C.text},
  tagline:{fontSize:9,letterSpacing:2.2,color:C.muted,marginTop:4,fontWeight:"700"},
  refreshButton:{width:42,height:42,borderRadius:14,backgroundColor:C.panel2,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:C.line},
  refreshIcon:{fontSize:27,color:C.green,marginTop:-3},
  tabs:{flexDirection:"row",paddingHorizontal:22,borderBottomWidth:1,borderBottomColor:C.line},
  tab:{paddingVertical:14,marginRight:28,position:"relative"},
  tabText:{fontSize:11,fontWeight:"800",letterSpacing:1.2,color:C.muted},
  activeTabText:{color:C.green},
  tabUnderline:{position:"absolute",height:2,backgroundColor:C.green,bottom:-1,left:0,right:0,borderRadius:2},
  sectionHeader:{paddingHorizontal:22,paddingTop:24,paddingBottom:13,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  sectionTitle:{fontSize:13,fontWeight:"900",letterSpacing:1.4,color:C.text},
  sectionSub:{fontSize:9,color:C.muted,letterSpacing:1.1,marginTop:5,fontWeight:"700"},
  livePill:{flexDirection:"row",alignItems:"center",backgroundColor:"#291619",paddingHorizontal:9,paddingVertical:6,borderRadius:20},
  liveDot:{width:6,height:6,borderRadius:4,backgroundColor:C.red,marginRight:6},
  liveText:{fontSize:9,fontWeight:"900",letterSpacing:1,color:"#ff858a"},
  list:{paddingHorizontal:18,paddingBottom:24},
  card:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:17,padding:16,marginBottom:12},
  cardTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:13},
  series:{fontSize:9,color:C.muted,fontWeight:"800",letterSpacing:1,flex:1,marginRight:10},
  status:{fontSize:9,color:C.gold,fontWeight:"900",letterSpacing:1},
  matchTitle:{fontSize:16,color:C.text,fontWeight:"800",lineHeight:22},
  scoreRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12},
  scoreCol:{flex:1},
  score:{fontSize:20,color:C.green,fontWeight:"900",letterSpacing:.3},
  scoreSecondary:{fontSize:13,color:C.muted,marginTop:5},
  chevron:{fontSize:28,color:C.muted,paddingHorizontal:6},
  matchNote:{fontSize:11,color:C.muted,marginTop:10,lineHeight:17},
  center:{flex:1,alignItems:"center",justifyContent:"center"},
  loadingText:{color:C.muted,fontSize:12,marginTop:12},
  emptyWrap:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:34},
  emptyIcon:{fontSize:34,marginBottom:12},
  emptyTitle:{fontSize:17,fontWeight:"900",color:C.text,marginBottom:8},
  empty:{fontSize:12,color:C.muted,textAlign:"center",lineHeight:19,marginTop:10},
  retry:{marginTop:18,backgroundColor:C.green,paddingHorizontal:22,paddingVertical:12,borderRadius:10},
  retryText:{fontSize:10,fontWeight:"900",color:"#10120c",letterSpacing:1},
  footer:{borderTopWidth:1,borderTopColor:C.line,paddingVertical:13,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:9},
  footerText:{fontSize:8,color:"#666b72",letterSpacing:1.2,fontWeight:"800"},
  footerDot:{fontSize:7,color:C.green},
  content:{flex:1,paddingHorizontal:18},
  back:{paddingVertical:17},
  backText:{color:C.green,fontSize:10,fontWeight:"900",letterSpacing:1},
  detailCard:{backgroundColor:C.panel2,borderRadius:18,borderWidth:1,borderColor:C.line,padding:20,marginBottom:22},
  detailEyebrow:{fontSize:9,color:C.green,fontWeight:"900",letterSpacing:1.5,marginBottom:12},
  detailTitle:{fontSize:20,fontWeight:"900",color:C.text,lineHeight:28},
  detailScore:{fontSize:25,fontWeight:"900",color:C.green,marginTop:18},
  detailStatus:{fontSize:11,color:C.muted,marginTop:8},
  playerHeading:{fontSize:10,color:C.green,fontWeight:"900",letterSpacing:1.3,marginTop:20,marginBottom:10},
  playerRow:{flexDirection:"row",justifyContent:"space-between",paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.line},
  playerName:{fontSize:13,color:C.text,fontWeight:"700"},
  playerScore:{fontSize:13,color:C.text,fontWeight:"800"},
  disclaimer:{fontSize:10,color:"#6e737b",lineHeight:16,marginTop:18}
});