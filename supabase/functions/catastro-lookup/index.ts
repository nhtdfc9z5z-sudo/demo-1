const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lon, planta, puerta, provincia, ciudad, referencia_catastral } = await req.json();

    const hasRC = typeof referencia_catastral === 'string' && referencia_catastral.length >= 14;

    if (!hasRC && (!lat || !lon)) {
      return new Response(
        JSON.stringify({ success: false, error: 'lat/lon or referencia_catastral required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rc14: string;
    let provName = provincia || '';
    let munName = ciudad || '';

    if (hasRC) {
      // Modo directo por RC: saltamos Consulta_RCCOOR y usamos prov/mun del body tal cual.
      rc14 = referencia_catastral.slice(0, 14);
    } else {
      // Step 1: Get cadastral reference from coordinates
      const coordUrl = `https://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccoordenadas.asmx/Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=${lon}&Coordenada_Y=${lat}`;
      const coordResponse = await fetch(coordUrl);
      const coordXml = await coordResponse.text();

      const pc1Match = coordXml.match(/<pc1>([^<]+)<\/pc1>/);
      const pc2Match = coordXml.match(/<pc2>([^<]+)<\/pc2>/);

      if (!pc1Match || !pc2Match) {
        return new Response(
          JSON.stringify({ success: false, error: 'No cadastral reference found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      rc14 = pc1Match[1] + pc2Match[1];

      // Determine province name for Catastro (strip "Comunidad de", "Provincia de", etc.)
      provName = provName
        .replace(/^comunidad\s+(aut[oó]noma\s+)?(de\s+)?/i, '')
        .replace(/^provincia\s+de\s+/i, '')
        .replace(/^principado\s+de\s+/i, '')
        .replace(/^regi[oó]n\s+de\s+/i, '')
        .replace(/^islas\s+/i, '')
        .replace(/^illes\s+/i, '')
        .trim();

      // Also try from XML
      const npMatch = coordXml.match(/<np>([^<]+)<\/np>/);
      const nmMatch = coordXml.match(/<nm>([^<]+)<\/nm>/);
      if (npMatch) provName = npMatch[1];
      if (nmMatch) munName = nmMatch[1];
    }

    console.log('RC14:', rc14, 'Provincia:', provName, 'Municipio:', munName);

    let superficie: number | null = null;
    let anoConstruccion: number | null = null;
    const availableUnits: { planta: string; puerta: string; fullRc: string }[] = [];
    let matchedRc = (hasRC && referencia_catastral.length >= 20)
      ? referencia_catastral.slice(0, 20)
      : rc14;

    if (provName && munName) {
      try {
        // Step 2: Get all units in the building
        const dnprcUrl = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=${encodeURIComponent(provName)}&Municipio=${encodeURIComponent(munName)}&RC=${rc14}`;
        const dnprcResponse = await fetch(dnprcUrl);
        const dnprcXml = await dnprcResponse.text();
        console.log('DNPRC length:', dnprcXml.length);

        // Parse all rcdnp blocks to extract units
        const rcdnpBlocks = dnprcXml.split(/<rcdnp>/i).slice(1);
        console.log('Units found:', rcdnpBlocks.length);

        const normalise = (s: string) => s?.replace(/[º°ª\s]/g, '').toUpperCase() || '';
        const normPlanta = normalise(planta || '');
        const normPuerta = normalise(puerta || '');

        for (const block of rcdnpBlocks) {
          // Extract full RC components
          const bPc1 = block.match(/<pc1>([^<]+)<\/pc1>/)?.[1] || '';
          const bPc2 = block.match(/<pc2>([^<]+)<\/pc2>/)?.[1] || '';
          const bCar = block.match(/<car>([^<]+)<\/car>/)?.[1] || '';
          const bCc1 = block.match(/<cc1>([^<]+)<\/cc1>/)?.[1] || '';
          const bCc2 = block.match(/<cc2>([^<]+)<\/cc2>/)?.[1] || '';
          const unitFullRc = bPc1 + bPc2 + bCar + bCc1 + bCc2;

          // Extract planta and puerta from loint
          const ptMatch = block.match(/<pt>([^<]*)<\/pt>/);
          const puMatch = block.match(/<pu>([^<]*)<\/pu>/);
          const unitPt = ptMatch?.[1]?.trim() || '';
          const unitPu = puMatch?.[1]?.trim() || '';

          availableUnits.push({ planta: unitPt, puerta: unitPu, fullRc: unitFullRc });

          // Match specific unit
          if (normPlanta && normPuerta && normalise(unitPt) === normPlanta && normalise(unitPu) === normPuerta) {
            matchedRc = unitFullRc;
          } else if (normPlanta && !normPuerta && normalise(unitPt) === normPlanta) {
            matchedRc = unitFullRc;
          }
        }

        console.log('MatchedRC:', matchedRc, 'Available units:', availableUnits.length);

        // Step 3: Get detailed data for the matched unit using Consulta_DNPRC_Codigos
        // Extract province/municipality codes from the DNPRC response
        const cpCode = dnprcXml.match(/<cp>([^<]+)<\/cp>/)?.[1] || '';
        const cmCode = dnprcXml.match(/<cm>([^<]+)<\/cm>/)?.[1] || '';

        if (cpCode && cmCode) {
          const detailUrl = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejeroCodigos.asmx/Consulta_DNPRC_Codigos?CodigoProvincia=${cpCode}&CodigoMunicipio=${cmCode}&CodigoMunicipioINE=&RC=${matchedRc}`;
          console.log('Detail URL:', detailUrl);

          const detailResponse = await fetch(detailUrl);
          const detailXml = await detailResponse.text();
          console.log('Detail length:', detailXml.length);
          console.log('Detail sample:', detailXml.substring(0, 2000));

          // Extract construction year from <ant>
          const antMatch = detailXml.match(/<ant>([^<]+)<\/ant>/);
          if (antMatch) {
            anoConstruccion = parseInt(antMatch[1], 10);
            if (isNaN(anoConstruccion)) anoConstruccion = null;
          }

          // Extract surface from <sfc> in bice/debi blocks
          const biceBlocks = detailXml.split(/<bice>/i).slice(1);
          console.log('Bice blocks in detail:', biceBlocks.length);

          if (biceBlocks.length > 0) {
            // Use the first bice block's surface
            const sfcMatch = biceBlocks[0].match(/<sfc>([^<]+)<\/sfc>/);
            if (sfcMatch) {
              superficie = parseInt(sfcMatch[1], 10);
              if (isNaN(superficie)) superficie = null;
            }
          }

          // Fallback: try any sfc tag
          if (superficie === null) {
            const sfcMatch = detailXml.match(/<sfc>([^<]+)<\/sfc>/);
            if (sfcMatch) {
              superficie = parseInt(sfcMatch[1], 10);
              if (isNaN(superficie)) superficie = null;
            }
          }

          console.log('Result - superficie:', superficie, 'anoConstruccion:', anoConstruccion);
        }
      } catch (e) {
        console.error('Error in DNPRC lookup:', e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rc: matchedRc,
        superficie,
        anoConstruccion,
        availableUnits: availableUnits.map(u => ({ planta: u.planta, puerta: u.puerta })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
