import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseRcdnpBlock, parseDnplocResponse } from "./index.ts";

const XML_OK_PARCIAL = `
<consulta_dnploc>
  <lrcdnp>
    <rcdnp>
      <pc>
        <pc1>6547606</pc1>
        <pc2>VK2664N</pc2>
      </pc>
      <dt>
        <locs><lous><lourb>
          <dir><cv>CL PARQUE VOSA 13 Es:1 Pl:02 Pt:C</cv></dir>
        </lourb></lous></locs>
      </dt>
      <ldt>
        <cpt>
          <sfc><sup>62</sup></sfc>
          <aoc>1973</aoc>
        </cpt>
      </ldt>
    </rcdnp>
  </lrcdnp>
</consulta_dnploc>`;

const XML_OK_COMPLETA = `
<consulta_dnploc>
  <lrcdnp>
    <rcdnp>
      <pc><pc1>6547606</pc1><pc2>VK2664N</pc2></pc>
      <car>0011</car>
      <cc1>M</cc1>
      <cc2>I</cc2>
      <dt><locs><lous><lourb><dir><cv>CL EJEMPLO 1</cv></dir></lourb></lous></locs></dt>
      <ldt><cpt><sfc><sup>80</sup></sfc><aoc>1990</aoc></cpt></ldt>
    </rcdnp>
  </lrcdnp>
</consulta_dnploc>`;

const XML_ERROR = `
<consulta_dnploc>
  <control><cuerr>1</cuerr></control>
  <lerr><err><des>No se han encontrado datos</des></err></lerr>
</consulta_dnploc>`;

Deno.test("parseRcdnpBlock extrae datos del ejemplo Parque Vosa (parcial)", () => {
  const xml = XML_OK_PARCIAL;
  const { resultados, errorCatastro } = parseDnplocResponse(xml);
  assertEquals(errorCatastro, null);
  assertEquals(resultados.length, 1);
  const r = resultados[0];
  assertEquals(r.referencia_catastral, null);
  assertEquals(r.referencia_catastral_parcial, "6547606VK2664N");
  assertEquals(r.superficie_construida_m2, 62);
  assertEquals(r.ano_construccion, 1973);
  assertEquals(r.direccion_completa, "CL PARQUE VOSA 13 Es:1 Pl:02 Pt:C");
});

Deno.test("parseRcdnpBlock construye referencia completa cuando pc1+pc2+car+cc1+cc2 están", () => {
  const { resultados } = parseDnplocResponse(XML_OK_COMPLETA);
  assertEquals(resultados.length, 1);
  const r = resultados[0];
  assertEquals(r.referencia_catastral, "6547606VK2664N0011MI");
  assertEquals(r.referencia_catastral_parcial, null);
  assertEquals(r.superficie_construida_m2, 80);
  assertEquals(r.ano_construccion, 1990);
});

Deno.test("parseDnplocResponse devuelve errorCatastro si Catastro responde <err>", () => {
  const { resultados, errorCatastro } = parseDnplocResponse(XML_ERROR);
  assertEquals(resultados.length, 0);
  assertEquals(errorCatastro, "No se han encontrado datos");
});

Deno.test("nunca inventa caracteres si faltan componentes (car presente, cc1 ausente)", () => {
  const xml = `
    <rcdnp>
      <pc><pc1>1234567</pc1><pc2>ABCDEFG</pc2></pc>
      <car>0011</car>
    </rcdnp>`;
  const r = parseRcdnpBlock(xml);
  assertEquals(r.referencia_catastral, null);
  assertEquals(r.referencia_catastral_parcial, "1234567ABCDEFG");
});