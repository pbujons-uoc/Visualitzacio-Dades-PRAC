const controller = new ScrollMagic.Controller();

document.querySelectorAll(".continent-section, #country-charts-container").forEach((section) => {
    const isChartsContainer = section.id === "country-charts-container";
    const continent = section.dataset?.continent;

    const sectionAnimation = gsap.fromTo(
        section,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.6, ease: "none" }
    );

    new ScrollMagic.Scene({
        triggerElement: section,
        duration: isChartsContainer ? "100%" : "50%",
        triggerHook: isChartsContainer ? 0.8 : 0.5,
        reverse: true 
    })
        .setTween(sectionAnimation)
        .on("enter", () => {
            if (!isChartsContainer) loadData(continent);
        })
        .addTo(controller);
});
