// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFT {
    function factory() external view returns (address);
}

interface INFTContractURIdentifiable {
    event SetContractURI(string uri);

    function contractURI() external view returns (string memory);

    function setContractURI(string calldata _contractURI) external;
}
