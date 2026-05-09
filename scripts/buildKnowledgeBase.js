const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dataDir = path.join(__dirname, '../data/matches');
const playersFile = path.join(__dirname, '../data/players.json');
const questionsFile = path.join(__dirname, '../data/questions.json');

// We will track statistics for every player
const playerStats = {};

function initPlayer(name) {
  if (!playerStats[name]) {
    playerStats[name] = {
      runs: 0,
      ballsFaced: 0,
      matchesBatting: new Set(),
      matchesBowling: new Set(),
      wickets: 0,
      runsConceded: 0,
      ballsBowled: 0,
      teams: new Set(),
      years: new Set(),
      dismissals: 0, // as wicketkeeper
      highestScore: 0,
      currentInningsRuns: 0, // temp
      fiveWicketHauls: 0,
      matchWickets: 0, // temp
      fifties: 0,
      centuries: 0,
      sixes: 0,
      fours: 0,
      powerplayBallsBowled: 0,
      deathBallsBowled: 0
    };
  }
}

async function processFiles() {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv') && !f.includes('info'));
  console.log(`Processing ${files.length} match files...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const matchId = file.split('.')[0];
    const filePath = path.join(dataDir, file);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let isFirstLine = true;
    let matchPlayers = new Set();
    
    // Reset temp match stats
    for (const p in playerStats) {
      playerStats[p].currentInningsRuns = 0;
      playerStats[p].matchWickets = 0;
    }

    for await (const line of rl) {
      if (isFirstLine) { isFirstLine = false; continue; } // Skip header

      // match_id,season,start_date,venue,innings,ball,batting_team,bowling_team,striker,non_striker,bowler,runs_off_bat,extras,wides,noballs,byes,legbyes,penalty,wicket_type,player_dismissed,other_wicket_type,other_player_dismissed
      const parts = line.split(',');
      if (parts.length < 20) continue;

      const season = parts[1];
      const battingTeam = parts[6];
      const bowlingTeam = parts[7];
      const striker = parts[8];
      const nonStriker = parts[9];
      const bowler = parts[10];
      const runsOffBat = parseInt(parts[11]) || 0;
      const wicketType = parts[18];
      
      initPlayer(striker);
      initPlayer(nonStriker);
      initPlayer(bowler);

      matchPlayers.add(striker);
      matchPlayers.add(nonStriker);
      matchPlayers.add(bowler);

      const pStriker = playerStats[striker];
      pStriker.teams.add(battingTeam);
      pStriker.years.add(season);
      pStriker.matchesBatting.add(matchId);
      pStriker.runs += runsOffBat;
      pStriker.ballsFaced += 1;
      pStriker.currentInningsRuns += runsOffBat;
      if (runsOffBat === 6) pStriker.sixes += 1;
      if (runsOffBat === 4) pStriker.fours += 1;

      const pBowler = playerStats[bowler];
      pBowler.teams.add(bowlingTeam);
      pBowler.years.add(season);
      pBowler.matchesBowling.add(matchId);
      pBowler.ballsBowled += 1;
      pBowler.runsConceded += runsOffBat + (parseInt(parts[13]) || 0) + (parseInt(parts[14]) || 0); // off bat + wides + noballs

      const overStr = parts[5];
      if (overStr) {
        const overFloat = parseFloat(overStr);
        if (overFloat < 6.0) pBowler.powerplayBallsBowled += 1;
        if (overFloat >= 15.0) pBowler.deathBallsBowled += 1;
      }

      if (wicketType && wicketType !== 'run out' && wicketType !== 'retired hurt' && wicketType !== 'retired out' && wicketType !== 'obstructing the field') {
        pBowler.wickets += 1;
        pBowler.matchWickets += 1;
      }
    }

    // Process end of match stats
    for (const p of matchPlayers) {
      const stats = playerStats[p];
      if (stats.currentInningsRuns > stats.highestScore) stats.highestScore = stats.currentInningsRuns;
      if (stats.currentInningsRuns >= 100) stats.centuries += 1;
      else if (stats.currentInningsRuns >= 50) stats.fifties += 1;
      
      if (stats.matchWickets >= 5) stats.fiveWicketHauls += 1;
    }
  }

  // Generate attributes for players
  console.log("Generating player attributes...");
  const validPlayers = [];
  
  for (const [name, stats] of Object.entries(playerStats)) {
    const totalMatches = new Set([...stats.matchesBatting, ...stats.matchesBowling]).size;
    
    // Only include players who have played at least 15 matches to keep the dataset relevant
    if (totalMatches < 15) continue;

    const attributes = {};
    
    // Roles
    attributes['is_batsman'] = stats.runs > 500;
    attributes['is_bowler'] = stats.wickets > 15;
    attributes['is_allrounder'] = stats.runs > 300 && stats.wickets > 15;
    
    // Achievements
    attributes['scored_century'] = stats.centuries > 0;
    attributes['scored_multiple_centuries'] = stats.centuries > 1;
    attributes['highest_score_over_120'] = stats.highestScore >= 120;
    attributes['has_50_plus_score'] = (stats.fifties + stats.centuries) > 0;
    attributes['scored_over_1000_runs'] = stats.runs >= 1000;
    attributes['scored_over_3000_runs'] = stats.runs >= 3000;
    attributes['scored_over_5000_runs'] = stats.runs >= 5000;
    attributes['hit_over_50_sixes'] = stats.sixes >= 50;
    attributes['hit_over_150_sixes'] = stats.sixes >= 150;
    
    attributes['took_5_wicket_haul'] = stats.fiveWicketHauls > 0;
    attributes['took_over_50_wickets'] = stats.wickets >= 50;
    attributes['took_over_100_wickets'] = stats.wickets >= 100;
    attributes['took_over_150_wickets'] = stats.wickets >= 150;

    // Strike rate & Economy
    const sr = stats.ballsFaced > 0 ? (stats.runs / stats.ballsFaced) * 100 : 0;
    attributes['high_strike_rate_batter'] = sr > 140 && stats.runs > 500;
    
    const econ = stats.ballsBowled > 0 ? (stats.runsConceded / (stats.ballsBowled / 6)) : 0;
    attributes['economy_under_8'] = econ > 0 && econ < 8.0 && stats.wickets > 15;
    
    // Bowler specific roles
    attributes['is_powerplay_bowler'] = stats.powerplayBallsBowled >= 150;
    attributes['is_death_bowler'] = stats.deathBallsBowled >= 150;

    // Eras / Seasons / Matches
    attributes['played_in_inaugural_2008'] = stats.years.has('2007/08') || stats.years.has('2008');
    attributes['played_in_recent_2023_2024'] = stats.years.has('2023') || stats.years.has('2024');
    attributes['played_over_100_matches'] = totalMatches >= 100;
    attributes['played_over_150_matches'] = totalMatches >= 150;
    
    // Teams
    attributes['played_for_csk'] = stats.teams.has('Chennai Super Kings');
    attributes['played_for_mi'] = stats.teams.has('Mumbai Indians');
    attributes['played_for_rcb'] = stats.teams.has('Royal Challengers Bangalore');
    attributes['played_for_kkr'] = stats.teams.has('Kolkata Knight Riders');
    attributes['played_for_srh'] = stats.teams.has('Sunrisers Hyderabad') || stats.teams.has('Deccan Chargers');
    attributes['played_for_rr'] = stats.teams.has('Rajasthan Royals');
    attributes['played_for_dc'] = stats.teams.has('Delhi Capitals') || stats.teams.has('Delhi Daredevils');
    attributes['played_for_pbks'] = stats.teams.has('Punjab Kings') || stats.teams.has('Kings XI Punjab');
    attributes['played_for_lsg'] = stats.teams.has('Lucknow Super Giants');
    attributes['played_for_gt'] = stats.teams.has('Gujarat Titans');
    attributes['played_for_pwi'] = stats.teams.has('Pune Warriors');
    attributes['played_for_rps'] = stats.teams.has('Rising Pune Supergiant') || stats.teams.has('Rising Pune Supergiants');
    attributes['played_for_ktk'] = stats.teams.has('Kochi Tuskers Kerala');
    attributes['played_for_gl'] = stats.teams.has('Gujarat Lions');

    // Nationality & Wicketkeeper - We can't perfectly extract this from just CSV stats, 
    // but the engine will dynamically rely on the data it HAS. 
    // We will drop is_indian, is_wicketkeeper for purely stats-based attributes unless we hardcode a list.
    
    validPlayers.push({ name, attributes });
  }

  console.log(`Generated knowledge base for ${validPlayers.length} players.`);
  
  fs.writeFileSync(playersFile, JSON.stringify(validPlayers, null, 2));

  // Generate Questions mapping
  const questions = {
    "is_batsman": "Is your player recognized primarily as a solid batsman (scored 500+ runs)?",
    "is_bowler": "Is your player recognized primarily as a bowler (taken 15+ wickets)?",
    "is_allrounder": "Is your player a genuine all-rounder (300+ runs and 15+ wickets)?",
    "scored_century": "Has your player ever scored a century (100+ runs) in an IPL match?",
    "scored_multiple_centuries": "Has your player scored multiple centuries in the IPL?",
    "highest_score_over_120": "Has your player ever hit a massive score of 120+ runs in a single innings?",
    "has_50_plus_score": "Has your player ever scored a 50+ score in the IPL?",
    "scored_over_1000_runs": "Has your player accumulated over 1,000 career runs in the IPL?",
    "scored_over_3000_runs": "Is your player an elite run-scorer with over 3,000 career IPL runs?",
    "scored_over_5000_runs": "Is your player an absolute legend with over 5,000 career IPL runs?",
    "hit_over_50_sixes": "Has your player hit more than 50 career sixes in the IPL?",
    "hit_over_150_sixes": "Is your player a massive power-hitter with over 150 career IPL sixes?",
    "took_5_wicket_haul": "Has your player ever taken a 5-wicket haul in a single IPL match?",
    "took_over_50_wickets": "Has your player taken more than 50 career wickets in the IPL?",
    "took_over_100_wickets": "Is your player an elite bowler with over 100 career IPL wickets?",
    "took_over_150_wickets": "Is your player a legendary bowler with over 150 career IPL wickets?",
    "high_strike_rate_batter": "Is your player known for highly aggressive batting (career strike rate > 140)?",
    "economy_under_8": "Is your player known for tight bowling (career economy under 8.0)?",
    "is_powerplay_bowler": "Does your player frequently bowl in the powerplay (first 6 overs)?",
    "is_death_bowler": "Is your player known as a specialist death bowler (overs 16-20)?",
    "played_over_100_matches": "Has your player played in over 100 IPL matches?",
    "played_over_150_matches": "Is your player an IPL veteran with over 150 matches played?",
    "played_in_inaugural_2008": "Did your player participate in the inaugural 2008 IPL season?",
    "played_in_recent_2023_2024": "Has your player participated in the recent 2023 or 2024 IPL seasons?",
    "played_for_csk": "Has your player ever played for Chennai Super Kings (CSK)?",
    "played_for_mi": "Has your player ever played for Mumbai Indians (MI)?",
    "played_for_rcb": "Has your player ever played for Royal Challengers Bangalore (RCB)?",
    "played_for_kkr": "Has your player ever played for Kolkata Knight Riders (KKR)?",
    "played_for_srh": "Has your player ever played for Sunrisers Hyderabad (SRH) or Deccan Chargers?",
    "played_for_rr": "Has your player ever played for Rajasthan Royals (RR)?",
    "played_for_dc": "Has your player ever played for Delhi Capitals / Daredevils (DC)?",
    "played_for_pbks": "Has your player ever played for Punjab Kings / Kings XI (PBKS)?",
    "played_for_lsg": "Has your player ever played for Lucknow Super Giants (LSG)?",
    "played_for_gt": "Has your player ever played for Gujarat Titans (GT)?",
    "played_for_pwi": "Did your player ever play for the defunct Pune Warriors India (PWI)?",
    "played_for_rps": "Did your player ever play for Rising Pune Supergiant (RPS)?",
    "played_for_ktk": "Did your player ever play for the defunct Kochi Tuskers Kerala (KTK)?",
    "played_for_gl": "Did your player ever play for Gujarat Lions (GL)?"
  };

  fs.writeFileSync(questionsFile, JSON.stringify(questions, null, 2));
  console.log("Written players.json and questions.json");
}

processFiles().catch(console.error);
