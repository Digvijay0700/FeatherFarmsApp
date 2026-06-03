import { router } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Share, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { db } from '../firebaseConfig';

const FARM_ID  = 'farm_001';
const BATCH_ID = 'batch_001';

// ─────────────────────────────────────────────────────────────
//  STD TABLES
// ─────────────────────────────────────────────────────────────
const STD_ABW: Record<number,number> = {
  1:58,2:74,3:93,4:115,5:140,6:170,7:204,8:241,9:281,10:323,
  11:367,12:414,13:463,14:514,15:567,16:623,17:682,18:744,19:809,20:877,
  21:949,22:1026,23:1106,24:1188,25:1272,26:1357,27:1443,28:1529,29:1616,30:1704,
  31:1792,32:1880,33:1969,34:2055,35:2147,36:2236,37:2326,38:2416,39:2506,40:2597,
  41:2688,42:2779,43:2870,44:2961,45:3052,
};
const STD_FCR: Record<number,number> = {
  1:0.19,2:0.35,3:0.48,4:0.59,5:0.68,6:0.75,7:0.81,8:0.88,9:0.90,10:0.94,
  11:0.97,12:1.00,13:1.02,14:1.05,15:1.08,16:1.10,17:1.13,18:1.15,19:1.17,20:1.19,
  21:1.21,22:1.23,23:1.25,24:1.26,25:1.27,26:1.29,27:1.30,28:1.32,29:1.34,30:1.35,
  31:1.37,32:1.39,33:1.41,34:1.43,35:1.45,36:1.47,37:1.49,38:1.52,39:1.54,40:1.55,
  41:1.57,42:1.59,
};
const STD_FCR_DAY: Record<number,number> = {
  1:0.85,2:0.94,3:1.00,4:1.05,5:1.08,6:1.10,7:1.12,8:1.14,9:1.15,10:1.17,
  11:1.18,12:1.21,13:1.24,14:1.31,15:1.34,16:1.38,17:1.39,18:1.40,19:1.42,20:1.43,
  21:1.44,22:1.44,23:1.45,24:1.46,25:1.48,26:1.51,27:1.53,28:1.58,29:1.62,30:1.66,
  31:1.72,32:1.77,33:1.82,34:1.90,35:1.97,36:2.01,37:2.01,38:2.06,39:2.07,40:2.07,
  41:2.11,42:2.13,
};
const STD_GAIN: Record<number,number> = {
  1:13,2:16,3:19,4:22,5:25,6:30,7:34,8:37,9:40,10:42,
  11:44,12:47,13:49,14:51,15:53,16:56,17:59,18:62,19:65,20:68,
  21:72,22:77,23:80,24:82,25:84,26:85,27:86,28:86,29:87,30:88,
  31:88,32:88,33:89,34:89,35:89,36:89,37:90,38:90,39:90,40:91,
  41:91,42:91,
};

function getStd(day: number) {
  const d = Math.min(Math.max(day,1),45);
  return {
    abw_std:         STD_ABW[d]     ?? 0,
    fcr_std:         STD_FCR[d]     ?? 0,
    day_fcr_std:     STD_FCR_DAY[d] ?? 0,
    weight_gain_std: STD_GAIN[d]    ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
//  CSV REPORT GENERATOR (downloads as .csv — opens in Excel)
// ─────────────────────────────────────────────────────────────
async function generateAndShareReport(records: any[]) {
  if (!records.length) {
    Alert.alert('No data', 'No records found to export.');
    return;
  }

  const sorted = [...records].sort((a,b) => (a.day||0) - (b.day||0));

  const headers = [
    'Date','Day','Op Bal','Mort Daily','Mort Cum','Mort %',
    'Feed Received','Daily Consume','Feed Balance','Cum Consume',
    'ABW Std','ABW Act','Wt Gain Std','Wt Gain Act',
    'FCR Std','FCR Act','Day FCR Std','Day FCR Act',
    'Water pH','PM Lesions','Notes'
  ].join('\t');

  const rows = sorted.map(r => {
    const d   = r.day ?? 0;
    const std = getStd(d);
    const mortPct = r.op_bal
      ? ((r.mortality_cum ?? 0) / r.op_bal * 100).toFixed(3) + '%'
      : '0%';
    return [
      r.date ?? '',
      d,
      r.op_bal ?? '',
      r.mortality_daily ?? 0,
      r.mortality_cum ?? 0,
      mortPct,
      r.feed_receive ?? '',
      r.daily_consume ?? '',
      r.feed_balance ?? '',
      r.cum_consume ?? '',
      std.abw_std,
      r.abw_act ?? '',
      std.weight_gain_std,
      r.weight_gain_act ?? '',
      std.fcr_std,
      r.fcr_act ?? '',
      std.day_fcr_std,
      r.day_fcr_act ?? '',
      r.water_ph ?? '',
      r.pm_lesions ?? '',
      r.pm_notes ?? '',
    ].join('\t');
  });

  const title  = "FeatherFarms — Broiler Daily Performance Record";
  const farm   = "Farm: Digvijay's Farm | Breed: Venkeys | Placed: 4794 birds";
  const report = [title, farm, '', headers, ...rows].join('\n');

  await Share.share({
    message: report,
    title:   `FeatherFarms_Report_${new Date().toISOString().split('T')[0]}`,
  });
}

// ─────────────────────────────────────────────────────────────
//  FIELD COMPONENT
// ─────────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, unit='', keyboardType='numeric' as any,
  placeholder='0', hint='', readOnly=false }: any) {
  return (
    <View style={s.fieldRow}>
      <View style={{flex:1}}>
        <Text style={s.fieldLabel}>{label}</Text>
        {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={s.fieldRight}>
        <TextInput
          style={[s.fieldInput, readOnly && s.fieldReadOnly]}
          value={value}
          onChangeText={readOnly ? undefined : onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#bbb"
          editable={!readOnly}
        />
        {unit ? <Text style={s.fieldUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function SectionHeader({ title, color='#F5A623' }: any) {
  return (
    <View style={[s.sectionHeader,{borderLeftColor:color}]}>
      <Text style={[s.sectionTitle,{color}]}>{title}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  RECORDS LIST
// ─────────────────────────────────────────────────────────────
function RecordsList({ records }: { records: any[] }) {
  if (!records.length) return (
    <View style={s.emptyRecords}>
      <Text style={s.emptyRecordsText}>No records yet — add the first one above.</Text>
    </View>
  );

  return (
    <View style={s.recordsList}>
      <Text style={s.recordsTitle}>📋 Saved records ({records.length} days)</Text>
      {[...records].sort((a,b)=>(b.day||0)-(a.day||0)).map(r => {
        const fcrOk   = (r.fcr_act||0) < 1.7;
        const fcrWarn = (r.fcr_act||0) >= 1.7 && (r.fcr_act||0) < 1.9;
        const fcrColor = fcrOk ? '#66BB6A' : fcrWarn ? '#F5A623' : '#EF5350';
        return (
          <View key={String(r.day)} style={s.recordRow}>
            <View style={s.recordLeft}>
              <Text style={s.recordDay}>D{r.day}</Text>
              <Text style={s.recordDate}>{(r.date||'').slice(5)}</Text>
            </View>
            <View style={s.recordMid}>
              <Text style={s.recordStat}>{(r.op_bal||0).toLocaleString()} birds</Text>
              <Text style={s.recordStatSub}>
                Mort: {r.mortality_daily??0}  ·  ABW: {r.abw_act??'—'}g
              </Text>
            </View>
            <View style={s.recordRight}>
              <Text style={[s.recordFCR,{color:fcrColor}]}>FCR {r.fcr_act??'—'}</Text>
              <Text style={s.recordABW}>Std {getStd(r.day||1).abw_std}g</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
export default function DailyRecordScreen() {
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [records,     setRecords]     = useState<any[]>([]);

  const [day,         setDay]         = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0]);
  const [opBal,       setOpBal]       = useState('');
  const [mortDaily,   setMortDaily]   = useState('0');
  const [mortCum,     setMortCum]     = useState('0');
  const [pmLesions,   setPmLesions]   = useState('');
  const [feedReceive, setFeedReceive] = useState('0');
  const [feedConsume, setFeedConsume] = useState('0');
  const [feedBalance, setFeedBalance] = useState('0');
  const [cumConsume,  setCumConsume]  = useState('0');
  const [abwAct,      setAbwAct]      = useState('');
  const [fcrAct,      setFcrAct]      = useState('');
  const [dayFcrAct,   setDayFcrAct]   = useState('');
  const [waterPh,     setWaterPh]     = useState('7.0');
  const [pmNotes,     setPmNotes]     = useState('');
  const [prevAbwAct,  setPrevAbwAct]  = useState(0);

  const dayNum = parseInt(day) || 0;
  const std    = getStd(dayNum);
  const weightGainAct = abwAct ? parseFloat(abwAct) - prevAbwAct : 0;

  // Listen to records + auto-fill next day
  useEffect(() => {
    const q = query(
      collection(db,'farms',FARM_ID,'batches',BATCH_ID,'daily_records'),
      orderBy('day','desc'),
    );
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      setRecords(docs);
      if (!snap.empty && !day) {
        const last = snap.docs[0].data();
        const next = (last.day||0)+1;
        setDay(String(next));
        setOpBal(String((last.op_bal||0)-(last.mortality_daily||0)));
        setMortCum(String(last.mortality_cum||0));
        setCumConsume(String(last.cum_consume||0));
        setPrevAbwAct(last.abw_act||0);
        const d = new Date(last.date||new Date());
        d.setDate(d.getDate()+1);
        setDate(d.toISOString().split('T')[0]);
      }
    });
  }, []);

  async function save() {
    if (!day || !opBal) {
      Alert.alert('Required','Please enter Day number and Opening Balance.');
      return;
    }
    setSaving(true);
    try {
      const d     = parseInt(day);
      const opB   = parseInt(opBal);
      const mortD = parseInt(mortDaily||'0');
      const mortC = parseInt(mortCum||'0') + mortD;
      const cumC  = parseInt(cumConsume||'0') + parseInt(feedConsume||'0');
      const std2  = getStd(d);

      await setDoc(
        doc(db,'farms',FARM_ID,'batches',BATCH_ID,'daily_records',String(d)),
        {
          day:d, date,
          op_bal:          opB,
          mortality_daily: mortD,
          mortality_cum:   mortC,
          mort_pct:        parseFloat(((mortC/4794)*100).toFixed(3)),
          pm_lesions:      pmLesions,
          pm_notes:        pmNotes,
          feed_receive:    parseInt(feedReceive||'0'),
          daily_consume:   parseInt(feedConsume||'0'),
          feed_balance:    parseInt(feedBalance||'0'),
          cum_consume:     cumC,
          abw_std:         std2.abw_std,
          fcr_std:         std2.fcr_std,
          day_fcr_std:     std2.day_fcr_std,
          weight_gain_std: std2.weight_gain_std,
          abw_act:         parseFloat(abwAct||'0'),
          fcr_act:         parseFloat(fcrAct||'0'),
          day_fcr_act:     parseFloat(dayFcrAct||'0'),
          weight_gain_act: parseFloat(weightGainAct.toFixed(1)),
          water_ph:        parseFloat(waterPh||'7.0'),
          occ_rate:75, crowd_status:'normal',
          added_via:'app', added_at:new Date().toISOString(),
        }
      );

      setSaved(true);
      setTimeout(()=>setSaved(false),3000);

      // Prep next day
      setDay(String(d+1));
      setOpBal(String(opB-mortD));
      setMortCum(String(mortC));
      setCumConsume(String(cumC));
      setPrevAbwAct(parseFloat(abwAct||'0'));
      setMortDaily('0'); setFeedReceive('0'); setFeedConsume('0');
      setFeedBalance('0'); setAbwAct(''); setFcrAct('');
      setDayFcrAct(''); setPmLesions(''); setPmNotes('');
      const nd = new Date(date); nd.setDate(nd.getDate()+1);
      setDate(nd.toISOString().split('T')[0]);
    } catch(e) {
      Alert.alert('Error','Failed to save. Check internet connection.');
    } finally { setSaving(false); }
  }

  async function downloadReport() {
    setDownloading(true);
    try {
      await generateAndShareReport(records);
    } catch(e) {
      Alert.alert('Error', 'Could not generate report.');
      console.error(e);
    } finally { setDownloading(false); }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#F5A623" />

      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{flex:1}}>
          <Text style={s.headerTitle}>📋  Daily Record</Text>
          <Text style={s.headerSub}>STD auto-filled  ·  Syncs to web instantly</Text>
        </View>
        {/* DOWNLOAD REPORT BUTTON */}
        <TouchableOpacity
          style={[s.downloadBtn, downloading && {opacity:0.6}]}
          onPress={downloadReport}
          disabled={downloading}
          activeOpacity={0.8}
        >
          {downloading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.downloadBtnText}>⬇ Report</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {saved && (
          <View style={s.savedBanner}>
            <Text style={s.savedText}>✓  Day {day} saved — web updated!</Text>
          </View>
        )}

        <SectionHeader title="Basic Info" color="#F5A623" />
        <View style={s.card}>
          <Field label="Day number"       value={day}   onChangeText={setDay}   placeholder="e.g. 1" />
          <Field label="Date"             value={date}  onChangeText={setDate}  keyboardType="default" />
          <Field label="Opening balance"  value={opBal} onChangeText={setOpBal} unit="birds" />
        </View>

        <SectionHeader title="Mortality" color="#EF5350" />
        <View style={s.card}>
          <Field label="Daily mortality"    value={mortDaily} onChangeText={setMortDaily} unit="birds" />
          <Field label="Cumulative (auto)"  value={String(parseInt(mortCum||'0')+parseInt(mortDaily||'0'))} onChangeText={()=>{}} unit="birds" readOnly />
          <Field label="PM lesions"         value={pmLesions} onChangeText={setPmLesions} keyboardType="default" placeholder="e.g. Toxi-1" />
          <Field label="Notes"              value={pmNotes}   onChangeText={setPmNotes}   keyboardType="default" placeholder="Extra observations" />
        </View>

        <SectionHeader title="Feed (Bags)" color="#66BB6A" />
        <View style={s.card}>
          <Field label="Received today"  value={feedReceive} onChangeText={setFeedReceive} unit="bags" />
          <Field label="Consumed today"  value={feedConsume} onChangeText={setFeedConsume} unit="bags" />
          <Field label="Balance"         value={feedBalance} onChangeText={setFeedBalance} unit="bags" />
          <Field label="Cum. consumed"   value={String(parseInt(cumConsume||'0')+parseInt(feedConsume||'0'))} onChangeText={()=>{}} unit="bags" readOnly />
        </View>

        <SectionHeader title="Body Weight" color="#42A5F5" />
        <View style={s.card}>
          <Field label="ABW standard (auto)" value={String(std.abw_std)} onChangeText={()=>{}} unit="g" readOnly hint="Venkeys growth table" />
          <Field label="ABW actual"          value={abwAct}              onChangeText={setAbwAct}   unit="g" placeholder="Weigh 20 birds" />
          <Field label="Wt gain std (auto)"  value={String(std.weight_gain_std)} onChangeText={()=>{}} unit="g" readOnly />
          <Field label="Wt gain actual"      value={weightGainAct>0?String(weightGainAct.toFixed(1)):''} onChangeText={()=>{}} unit="g" readOnly hint="ABW - yesterday ABW" />
        </View>

        <SectionHeader title="FCR" color="#AB47BC" />
        <View style={s.card}>
          <Field label="Cum FCR std (auto)"  value={String(std.fcr_std)}     onChangeText={()=>{}} readOnly />
          <Field label="Cum FCR actual"       value={fcrAct}                  onChangeText={setFcrAct}    placeholder="e.g. 1.21" />
          <Field label="Day FCR std (auto)"   value={String(std.day_fcr_std)} onChangeText={()=>{}} readOnly />
          <Field label="Day FCR actual"        value={dayFcrAct}              onChangeText={setDayFcrAct} placeholder="e.g. 1.44" />
        </View>

        <SectionHeader title="Water" color="#26C6DA" />
        <View style={s.card}>
          <Field label="Water pH" value={waterPh} onChangeText={setWaterPh} placeholder="e.g. 7.3" />
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saving&&s.saveBtnDisabled]}
          onPress={save} disabled={saving} activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>💾  Save Day {day||'?'} Record</Text>
          }
        </TouchableOpacity>

        {/* DOWNLOAD REPORT FULL BUTTON */}
        <TouchableOpacity
          style={[s.reportBtn, downloading&&{opacity:0.6}]}
          onPress={downloadReport}
          disabled={downloading}
          activeOpacity={0.85}
        >
          {downloading
            ? <><ActivityIndicator color="#fff" style={{marginRight:8}} /><Text style={s.reportBtnText}>Generating report...</Text></>
            : <Text style={s.reportBtnText}>📊  Download Report ({records.length} days)</Text>
          }
        </TouchableOpacity>

        <Text style={s.syncNote}>
          Report fetches all {records.length} saved records from Firestore{'\n'}
          and exports as CSV — opens in Excel or Google Sheets
        </Text>

        <RecordsList records={records} />
        <View style={{height:40}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   {flex:1,backgroundColor:'#FFF8E7'},
  scroll: {padding:16,paddingBottom:40},
  header: {backgroundColor:'#F5A623',paddingTop:55,paddingHorizontal:16,paddingBottom:18,borderBottomLeftRadius:28,borderBottomRightRadius:28,flexDirection:'row',alignItems:'center',gap:10},
  backBtn:    {backgroundColor:'rgba(255,255,255,0.25)',borderRadius:12,padding:8},
  backText:   {fontSize:18,color:'#fff',fontWeight:'700'},
  headerTitle:{fontSize:20,fontWeight:'800',color:'#fff'},
  headerSub:  {fontSize:11,color:'rgba(255,255,255,0.85)',marginTop:2},
  downloadBtn:{backgroundColor:'rgba(255,255,255,0.25)',borderRadius:12,paddingHorizontal:12,paddingVertical:8},
  downloadBtnText:{fontSize:12,color:'#fff',fontWeight:'700'},
  savedBanner:{backgroundColor:'#EDF8EE',borderRadius:12,padding:12,marginBottom:12,alignItems:'center',borderWidth:1,borderColor:'#66BB6A'},
  savedText:  {color:'#2e7d32',fontWeight:'700',fontSize:13},
  sectionHeader:{borderLeftWidth:4,paddingLeft:10,marginTop:16,marginBottom:8},
  sectionTitle: {fontSize:13,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.5},
  card:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:4,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:8,elevation:2},
  fieldRow:    {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#f5f0e8'},
  fieldLabel:  {fontSize:13,color:'#555'},
  fieldHint:   {fontSize:10,color:'#aaa',marginTop:1},
  fieldRight:  {flexDirection:'row',alignItems:'center',gap:6},
  fieldInput:  {backgroundColor:'#FFF8E7',borderRadius:8,paddingHorizontal:10,paddingVertical:6,minWidth:80,textAlign:'right',fontSize:13,fontWeight:'600',color:'#333',borderWidth:1,borderColor:'#e8e3d0'},
  fieldReadOnly:{backgroundColor:'#f0ece0',color:'#888'},
  fieldUnit:   {fontSize:11,color:'#aaa',minWidth:30},
  saveBtn:         {backgroundColor:'#F5A623',borderRadius:16,paddingVertical:16,alignItems:'center',marginTop:20,marginBottom:10},
  saveBtnDisabled: {backgroundColor:'#ddd'},
  saveBtnText:     {fontSize:15,fontWeight:'800',color:'#fff'},
  reportBtn:       {backgroundColor:'#1A5276',borderRadius:16,paddingVertical:14,alignItems:'center',flexDirection:'row',justifyContent:'center',marginBottom:8},
  reportBtnText:   {fontSize:14,fontWeight:'700',color:'#fff'},
  syncNote:        {fontSize:11,color:'#aaa',textAlign:'center',marginBottom:16,lineHeight:18},
  recordsList:     {marginTop:8},
  recordsTitle:    {fontSize:14,fontWeight:'700',color:'#333',marginBottom:10},
  emptyRecords:    {padding:20,alignItems:'center'},
  emptyRecordsText:{fontSize:13,color:'#aaa'},
  recordRow:   {backgroundColor:'#fff',borderRadius:14,padding:14,marginBottom:8,flexDirection:'row',alignItems:'center',shadowColor:'#000',shadowOpacity:0.03,shadowRadius:6,elevation:1},
  recordLeft:  {width:55},
  recordDay:   {fontSize:16,fontWeight:'800',color:'#F5A623'},
  recordDate:  {fontSize:10,color:'#aaa',marginTop:2},
  recordMid:   {flex:1,paddingHorizontal:10},
  recordStat:  {fontSize:13,fontWeight:'600',color:'#333'},
  recordStatSub:{fontSize:11,color:'#aaa',marginTop:2},
  recordRight: {alignItems:'flex-end'},
  recordFCR:   {fontSize:14,fontWeight:'800'},
  recordABW:   {fontSize:11,color:'#aaa',marginTop:2},
});