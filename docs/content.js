export const stages = [
  {
    "title": "Grid + state",
    "equation": "Δ₄u = u_L + u_R + u_T + u_B − 4u_C",
    "body": "start with a 750 × 250 grid at zero height. each cell samples its four neighbours. a leapfrog update uses that spatial difference and the previous two states to advance the field. four updates per rendered frame."
  },
  {
    "title": "Source pulses",
    "equation": "s(t) = (1−2a²) exp(−a²)\na = πf₀(t−tᵢ)",
    "body": "add 17 ricker pulses at uneven times and positions, with three amplitude levels. each affects its centre cell and four neighbours. this view uses the same solver with the wall disabled, so the source field is visible."
  },
  {
    "title": "Wall + diffraction",
    "equation": "slit = 6 cells\nnominal wavelength ≈ 11 cells",
    "body": "add the reflective wall, leaving one opening. the transmitted field spreads into broad arcs. a 26-cell damping margin absorbs energy near the outer edges. this is the height magnitude, before surface shading."
  },
  {
    "title": "Display gain",
    "equation": "g(r) = min(26, 7.5√(1+r/5))",
    "body": "apply distance-based display gain on the right, then compress the height range. the outgoing waves become readable across the banner. this changes the recorded render heights; it never feeds back into the simulation."
  },
  {
    "title": "Raking light",
    "equation": "n = normalize(−∂ₓh, −∂ᵧh, 1)",
    "body": "sample the height differences in x and y to build surface normals. a low directional light catches the slopes. this pass shows continuous shading, before cast shadows and the grain threshold."
  },
  {
    "title": "Cast shadows",
    "equation": "I = max(0, n·L) S / L_z",
    "body": "sample the height field 12 times toward the light. higher crests reduce visibility S. the left image shows the occlusion mask, 1−S; the right applies that visibility to the lighting. same frame, same crop."
  },
  {
    "title": "Fixed grain",
    "equation": "g = 0.6G₁ + 0.4G₂",
    "body": "two fixed grain samples set a local threshold. the left image shows that threshold at 4×; the right shows grains turning white as the surface catches light. the grain stays still. the changing wave field selects what lights up."
  },
  {
    "title": "Complete",
    "equation": "120 frames / 24 fps = 5s",
    "body": "repeat the forcing schedule, run three warm-up cycles, then cache 120 height maps. webgl2 applies exposure, normals, shadows and grain to each map. this final pass reproduces the original clean render."
  }
];
