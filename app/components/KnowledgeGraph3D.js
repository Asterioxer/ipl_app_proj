"use client";

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import playersData from '../../data/players.json';

// Generate a spherical distribution of points (Fibonacci sphere)
function getFibonacciSpherePoints(samples, radius) {
  let points = [];
  let phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
  for (let i = 0; i < samples; i++) {
    let y = 1 - (i / (samples - 1)) * 2; // y goes from 1 to -1
    let radiusAtY = Math.sqrt(1 - y * y); // radius at y
    let theta = phi * i; // golden angle increment
    let x = Math.cos(theta) * radiusAtY;
    let z = Math.sin(theta) * radiusAtY;
    points.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }
  return points;
}

function NodeMesh({ position, data, onClick, isSelected }) {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      if (hovered || isSelected) {
        // Pulse effect
        const scale = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.1;
        meshRef.current.scale.set(scale, scale, scale);
      } else {
        meshRef.current.scale.set(1, 1, 1);
      }
    }
  });

  const color = isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#ffffff';

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        setHover(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(data);
      }}
    >
      <sphereGeometry args={[isSelected ? 0.3 : 0.15, 16, 16]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={isSelected || hovered ? 0.8 : 0.2} 
        roughness={0.2}
      />
      {/* Optionally show name on hover in 3D space */}
      {hovered && !isSelected && (
        <Html position={[0, 0.4, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'nowrap' }}>
            {data.name}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function Graph({ onSelectPlayer }) {
  const groupRef = useRef();
  const [selectedName, setSelectedName] = useState(null);

  // Exclude teams from the players list just in case, though the dataset might have teams as "players".
  // Actually, user wants all without exception, so we use the full array.
  const nodes = useMemo(() => {
    const points = getFibonacciSpherePoints(playersData.length, 12); // radius 12
    return playersData.map((player, i) => ({
      ...player,
      position: points[i]
    }));
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001; // slow rotation
    }
  });

  const handleSelect = (data) => {
    setSelectedName(data.name);
    onSelectPlayer(data);
  };

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <NodeMesh 
          key={i} 
          position={node.position} 
          data={node} 
          onClick={handleSelect}
          isSelected={selectedName === node.name}
        />
      ))}
      
      {/* Draw some faint lines connecting random nearby nodes to make it look like a network */}
      <Connections nodes={nodes} />
    </group>
  );
}

function Connections({ nodes }) {
  const lines = useMemo(() => {
    const points = [];
    // Connect each node to 2 random others to form a mesh look
    for (let i = 0; i < nodes.length; i++) {
      for(let j=0; j<2; j++) {
        const targetIdx = Math.floor(Math.random() * nodes.length);
        if(targetIdx !== i) {
          points.push(nodes[i].position);
          points.push(nodes[targetIdx].position);
        }
      }
    }
    return points;
  }, [nodes]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(lines);
    return geo;
  }, [lines]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.05} />
    </lineSegments>
  );
}

export default function KnowledgeGraph3D() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Format the camelCase/snake_case keys to human readable
  const formatKey = (key) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050510', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 25], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Graph onSelectPlayer={setSelectedPlayer} />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={40} autoRotate={false} />
      </Canvas>

      {/* Overlay Dashboard */}
      <AnimatePresence mode="wait">
        {selectedPlayer && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100%',
            maxWidth: '400px',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(10px)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            padding: '2rem',
            overflowY: 'auto',
            color: 'white',
            zIndex: 10,
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
          }}
          className="scrollbar-hide"
          >
            <button 
              onClick={() => setSelectedPlayer(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              &times;
            </button>
            
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#60a5fa', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              {selectedPlayer.name}
            </h2>
            
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>True Attributes</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(selectedPlayer.attributes).map(([key, val]) => {
                  if (val === true) {
                    return (
                      <span key={key} style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem'
                      }}>
                        {formatKey(key)}
                      </span>
                    )
                  }
                  return null;
                })}
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>False Attributes</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(selectedPlayer.attributes).map(([key, val]) => {
                  if (val === false) {
                    return (
                      <span key={key} style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#94a3b8',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {formatKey(key)}
                      </span>
                    )
                  }
                  return null;
                })}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', pointerEvents: 'none', color: 'rgba(255,255,255,0.6)', maxWidth: '300px' }}>
        <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Knowledge Base Explorer</h3>
        <p style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>Use your mouse to orbit, scroll to zoom, and click on any glowing node to inspect the player's underlying Machine Learning features.</p>
      </div>
    </div>
  );
}
