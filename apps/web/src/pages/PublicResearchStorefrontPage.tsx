import { useState } from 'react';
import { Button, Icon } from '@layerto/ui';
import { useSeo } from '../hooks/useSeo';

interface PublicResearchStorefrontPageProps {
  navigate: (to: string) => void;
}

export function PublicResearchStorefrontPage({ navigate }: PublicResearchStorefrontPageProps) {
  useSeo(
    'Research Storefront & Tech Bounty Board · Layerto',
    'Peer-reviewed publications, curated field datasets, and open AI tech collaboration bounties.',
  );

  const [activeTab, setActiveTab] = useState<'storefront' | 'bounties'>('storefront');
  const [selectedDiscipline, setSelectedDiscipline] = useState<'all' | 'marine_zoology' | 'forest_ecology'>('all');
  const [appliedBountyId, setAppliedBountyId] = useState<string | null>(null);

  const publications = [
    {
      id: 'pub-01',
      title: 'In-Situ Photogrammetry and Neural Scute Graphing for Marine Megafauna Telemetry',
      discipline: 'marine_zoology',
      disciplineLabel: 'Marine Zoology',
      authors: 'Dr. Elena Vance & Oxford DeepVision AI Lab',
      doi: '10.1038/s41598-026-08921-x',
      abstract:
        'A high-accuracy transformer pipeline designed to re-identify endangered Cheloniidae specimens from diver photographs, maintaining accuracy under turbidity shifts and variable optical refraction.',
      paperPrice: 'Open Access (Free PDF)',
      datasetPrice: '$149 (Commercial License)',
      modelPrice: '$49 (Weights Checkpoint)',
      geoProtected: true,
      downloads: 1420,
    },
    {
      id: 'pub-02',
      title: 'Autonomous UAV LiDAR Canopy Mesh Reconstruction and Biomass Estimation in Biosphere Reserves',
      discipline: 'forest_ecology',
      disciplineLabel: 'Forest Ecology',
      authors: 'Prof. Marcus Chen & Apeironaut Bio-Compute',
      doi: '10.1016/j.rse.2026.113042',
      abstract:
        'Volumetric canopy stratification and species-specific crown diameter regression using lightweight edge models flown aboard autonomous drone transects.',
      paperPrice: 'Open Access (Free PDF)',
      datasetPrice: '$249 (Commercial License)',
      modelPrice: '$79 (Point-Cloud Segmentation)',
      geoProtected: true,
      downloads: 890,
    },
  ];

  const bounties = [
    {
      id: 'bty-01',
      title: 'Turtle Scute Graphing & Re-ID Transformer Backbone',
      discipline: 'marine_zoology',
      disciplineLabel: 'Marine Zoology',
      leadResearcher: 'Dr. Elena Vance (Lead Marine Biologist)',
      areaName: 'Marine Zoology & Turtle Re-ID Vault',
      bountyAmount: '$1,500',
      collaborationModel: 'Escrow Funded Bounty + 30% Royalty Split',
      creditRoles: ['Methodology', 'Software', 'Formal Analysis'],
      specs: 'Train an individual re-ID model achieving >92% mAP on unseen coastal camera photos. Zero data leakage across train/val splits.',
      deadline: 'Nov 30, 2026',
      status: 'Open for Tech Collaborators',
    },
    {
      id: 'bty-02',
      title: 'Drone LiDAR 3D Canopy Layer Segmentation & Biomas Estimator',
      discipline: 'forest_ecology',
      disciplineLabel: 'Forest Ecology',
      leadResearcher: 'Prof. Marcus Chen (Forest Biosphere Lead)',
      areaName: 'Forest Canopy & Wildlife Vault',
      bountyAmount: '$2,000',
      collaborationModel: 'Escrow Funded Bounty + Academic Co-Authorship',
      creditRoles: ['Software', 'Validation', 'Investigation'],
      specs: 'Develop volumetric mesh extractor from point clouds. Must run within 500 GPU credits in the air-gapped container.',
      deadline: 'Dec 15, 2026',
      status: 'Open for Tech Collaborators',
    },
  ];

  const filteredPubs =
    selectedDiscipline === 'all'
      ? publications
      : publications.filter((p) => p.discipline === selectedDiscipline);

  const filteredBounties =
    selectedDiscipline === 'all'
      ? bounties
      : bounties.filter((b) => b.discipline === selectedDiscipline);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-pill border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
          <Icon name="shield" size={13} />
          <span>IUCN Geo-Privacy Protected • Air-Gapped Zero-Leakage Science</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-ink">
          Public Research Storefront & Open Tech Bounty Board
        </h1>
        <p className="text-sm text-muted leading-relaxed">
          Bridging domain zoologists and ecologists directly with computer vision engineers.
          License peer-reviewed datasets with guaranteed EXIF & GPS geo-privacy shielding,
          or claim funded tech bounties inside air-gapped zero-trust vaults.
        </p>

        {/* High-level Trust Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4 text-xs font-mono">
          <div className="rounded-control border border-line bg-card p-3">
            <div className="text-muted text-[11px]">Geo-Privacy Shield</div>
            <div className="text-base font-bold text-teal-600 dark:text-teal-400 mt-0.5">±10km Fuzzed</div>
          </div>
          <div className="rounded-control border border-line bg-card p-3">
            <div className="text-muted text-[11px]">Active Permitted Labs</div>
            <div className="text-base font-bold text-ink mt-0.5">14 Universities</div>
          </div>
          <div className="rounded-control border border-line bg-card p-3">
            <div className="text-muted text-[11px]">Open Tech Bounties</div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">$3,500 Escrow</div>
          </div>
          <div className="rounded-control border border-line bg-card p-3">
            <div className="text-muted text-[11px]">CRediT Attribution</div>
            <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">100% Guaranteed</div>
          </div>
        </div>
      </div>

      {/* Main Mode Switcher & Discipline Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('storefront')}
            className={`cursor-pointer px-4 py-2 rounded-control text-xs font-bold transition-all ${
              activeTab === 'storefront'
                ? 'bg-ink text-page shadow-sm'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            Research Publications & Datasets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bounties')}
            className={`cursor-pointer px-4 py-2 rounded-control text-xs font-bold transition-all ${
              activeTab === 'bounties'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            Open Tech Bounties ({bounties.length})
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted mr-1 font-semibold">Discipline:</span>
          {(['all', 'marine_zoology', 'forest_ecology'] as const).map((disc) => (
            <button
              key={disc}
              type="button"
              onClick={() => setSelectedDiscipline(disc)}
              className={`cursor-pointer rounded-pill px-3 py-1 font-medium capitalize transition-all ${
                selectedDiscipline === disc
                  ? 'bg-crimson text-white'
                  : 'border border-line bg-card text-muted hover:text-ink'
              }`}
            >
              {disc.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: PUBLIC STOREFRONT */}
      {activeTab === 'storefront' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredPubs.map((pub) => (
              <div
                key={pub.id}
                className="rounded-l2 border border-line bg-card p-6 shadow-l1 hover:border-line-strong transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-pill bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-teal-700 dark:text-teal-300">
                      {pub.disciplineLabel.toUpperCase()}
                    </span>
                    <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600">
                      ✓ PEER REVIEWED
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-ink leading-snug">
                    {pub.title}
                  </h3>
                  <div className="text-xs text-muted">
                    Authors: <strong className="text-ink">{pub.authors}</strong>
                  </div>
                  <div className="text-xs font-mono text-muted">
                    DOI: {pub.doi}
                  </div>

                  <p className="text-xs text-ink-secondary leading-relaxed line-clamp-3">
                    {pub.abstract}
                  </p>

                  {/* Geo-Privacy Protection Stamp */}
                  {pub.geoProtected && (
                    <div className="rounded-control bg-teal-500/5 border border-teal-500/20 p-2.5 text-[11px] text-teal-800 dark:text-teal-200 flex items-center gap-2">
                      <Icon name="shield" size={14} className="shrink-0 text-teal-600" />
                      <span>
                        <strong>Geo-Privacy Guarantee:</strong> All dataset telemetry stripped of GPS coordinates to protect endangered species habitats.
                      </span>
                    </div>
                  )}
                </div>

                {/* Pricing & Download Options */}
                <div className="pt-3 border-t border-line/60 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="rounded bg-page p-2 border border-line">
                      <span className="text-[10px] text-muted block">Preprint PDF</span>
                      <strong className="text-emerald-600">Free (Open)</strong>
                    </div>
                    <div className="rounded bg-page p-2 border border-line">
                      <span className="text-[10px] text-muted block">Field Dataset</span>
                      <strong className="text-ink">{pub.datasetPrice.split(' ')[0]}</strong>
                    </div>
                    <div className="rounded bg-page p-2 border border-line">
                      <span className="text-[10px] text-muted block">AI Model</span>
                      <strong className="text-ink">{pub.modelPrice.split(' ')[0]}</strong>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" icon="file" className="flex-1 cursor-pointer">
                      Read Preprint PDF
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="download"
                      className="flex-1 cursor-pointer"
                      onClick={() => alert(`Redirecting to commercial licensing for ${pub.title}...`)}
                    >
                      License Dataset
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: OPEN TECH BOUNTY BOARD */}
      {activeTab === 'bounties' && (
        <div className="space-y-6">
          <div className="rounded-control border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Icon name="trophy" size={18} className="text-amber-600 shrink-0" />
              <span>
                <strong>For ML Engineers & Tech Teams:</strong> Claim funded bounties to collaborate
                with top biologists. All code and model weights train inside isolated, air-gapped zero-trust
                containers with automated escrow and guaranteed co-authorship.
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="cursor-pointer shrink-0"
            >
              Open Dashboard
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredBounties.map((b) => (
              <div
                key={b.id}
                className="rounded-l2 border border-line bg-card p-6 shadow-l1 hover:border-line-strong transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-pill bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                      {b.bountyAmount} ESCROW FUNDED
                    </span>
                    <span className="rounded-pill bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-600">
                      {b.disciplineLabel.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-ink leading-snug">
                    {b.title}
                  </h3>

                  <div className="text-xs text-muted">
                    Lead PI: <strong className="text-ink">{b.leadResearcher}</strong>
                  </div>
                  <div className="text-xs text-muted">
                    Research Vault: <span className="font-mono text-ink">{b.areaName}</span>
                  </div>

                  <p className="text-xs text-ink-secondary leading-relaxed">
                    {b.specs}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-semibold text-muted block">
                      Contract CRediT Taxonomy Roles:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {b.creditRoles.map((role) => (
                        <span
                          key={role}
                          className="rounded bg-page px-2 py-0.5 text-[10px] font-mono text-ink border border-line"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-line/60 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-muted font-mono">
                    <span>Deadline: {b.deadline}</span>
                    <span className="text-emerald-600 font-bold">AIR-GAPPED COMPUTE</span>
                  </div>

                  {appliedBountyId === b.id ? (
                    <div className="rounded-control bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      ✓ Collaboration Application Transmitted to Lead Researcher
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      icon="arrowRight"
                      onClick={() => setAppliedBountyId(b.id)}
                      className="w-full cursor-pointer bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    >
                      Apply to Claim Tech Bounty ({b.bountyAmount})
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
